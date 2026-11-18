/**
 * Load operator GeoTIFF DEM into the Terrain Engine (Rust sampler).
 * Heights outside coverage / unsupported codecs → missing (Н/Д), never invented.
 */
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "@/services/tauri";
import { eventBus } from "@/services/events/eventBus";
import { dbGetJson, dbUpsertJson } from "@/services/database";
import {
  createGeoTiffAdapter,
  emptyTerrainAdapter,
  getDemMeta,
  registerBundledTerrariumDem,
  setTerrainAdapter,
  type DemSourceMeta,
} from "./terrainEngine";

const PATH_KEY = "geotiff_dem_path";

export interface GeoTiffLoadResult {
  ok: boolean;
  path: string | null;
  message: string;
  meta: DemSourceMeta;
}

export async function getSavedGeoTiffPath(): Promise<string | null> {
  const s = await dbGetJson<{ path?: string }>(PATH_KEY, {});
  return s.path?.trim() || null;
}

export async function saveGeoTiffPath(path: string | null): Promise<void> {
  await dbUpsertJson(PATH_KEY, { path: path ?? "" });
}

async function inspectAndActivate(path: string): Promise<GeoTiffLoadResult> {
  const info = await invoke<{
    validTiff: boolean;
    width?: number;
    height?: number;
    bitsPerSample?: number;
    compression?: number;
    hasGeoTags?: boolean;
    message: string;
    path: string;
  }>("terrain_inspect_geotiff", { path });

  if (!info.validTiff) {
    return {
      ok: false,
      path,
      message: info.message || "Файл не распознан как GeoTIFF",
      meta: getDemMeta(),
    };
  }

  if (info.hasGeoTags === false) {
    return {
      ok: false,
      path,
      message:
        info.message ||
        "Нет GeoTIFF-привязки (ModelPixelScale/Tiepoint) — высоты будут Н/Д",
      meta: getDemMeta(),
    };
  }

  try {
    await invoke("terrain_register_source", {
      id: "geotiff_active",
      name: path.split(/[/\\]/).pop() ?? path,
      sourceType: "geotiff",
      path,
      resolutionM: null,
    });
  } catch {
    /* local adapter still works without DB row */
  }

  const meta: DemSourceMeta = {
    id: "geotiff",
    name: path.split(/[/\\]/).pop() ?? path,
    sourceType: "geotiff",
    path,
    resolutionM: undefined,
    verticalDatum: "из файла (не нормализуем)",
    uncertaintyM: undefined,
  };
  setTerrainAdapter(createGeoTiffAdapter(path), meta);
  await saveGeoTiffPath(path);

  eventBus.emit(
    "info",
    "terrain",
    `GeoTIFF: ${meta.name} · ${info.width ?? "?"}×${info.height ?? "?"} · ${info.message}`,
  );

  return {
    ok: true,
    path,
    message: info.message,
    meta,
  };
}

/** Native file picker → inspect → register as active DEM. */
export async function pickAndLoadGeoTiff(): Promise<GeoTiffLoadResult> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      path: null,
      message: "GeoTIFF доступен только в desktop (Tauri)",
      meta: getDemMeta(),
    };
  }
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Выберите GeoTIFF DEM",
    filters: [
      { name: "GeoTIFF", extensions: ["tif", "tiff", "TIF", "TIFF"] },
      { name: "Все файлы", extensions: ["*"] },
    ],
  });
  if (!selected || Array.isArray(selected)) {
    return {
      ok: false,
      path: null,
      message: "Файл не выбран",
      meta: getDemMeta(),
    };
  }
  return inspectAndActivate(selected);
}

/** Load by explicit path (paste / restore). */
export async function loadGeoTiffFromPath(
  path: string,
): Promise<GeoTiffLoadResult> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      path,
      message: "GeoTIFF доступен только в desktop (Tauri)",
      meta: getDemMeta(),
    };
  }
  const p = path.trim();
  if (!p) {
    return {
      ok: false,
      path: null,
      message: "Путь пуст",
      meta: getDemMeta(),
    };
  }
  return inspectAndActivate(p);
}

/** Restore last GeoTIFF if saved; otherwise keep / register Terrarium. */
export async function restoreGeoTiffOrTerrarium(): Promise<DemSourceMeta> {
  const saved = await getSavedGeoTiffPath();
  if (saved && isTauriRuntime()) {
    const r = await loadGeoTiffFromPath(saved);
    if (r.ok) return r.meta;
  }
  await registerBundledTerrariumDem();
  return getDemMeta();
}

/** Switch sampling back to bundled offline Terrarium tiles. */
export async function switchToBundledTerrarium(): Promise<DemSourceMeta> {
  await saveGeoTiffPath(null);
  setTerrainAdapter(emptyTerrainAdapter, {
    id: "none",
    name: "Нет данных",
    sourceType: "none",
  });
  await registerBundledTerrariumDem();
  eventBus.emit("info", "terrain", "DEM: офлайн Terrarium");
  return getDemMeta();
}
