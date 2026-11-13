/**
 * Terrain Engine (V2) — DEM adapters.
 * Without a loaded DEM, heights are explicitly unavailable (N/A), never invented.
 */

export interface TerrainSample {
  latitude: number;
  longitude: number;
  elevationM: number | null;
  sourceId: string | null;
  missing: boolean;
}

export interface TerrainProfilePoint {
  distanceM: number;
  surfaceElevationM: number | null;
  antennaCenterAmslM: number | null;
  missing: boolean;
}

export interface DemSourceMeta {
  id: string;
  name: string;
  sourceType:
    | "geotiff"
    | "srtm"
    | "copernicus"
    | "aster"
    | "terrarium"
    | "custom"
    | "none";
  path?: string;
  resolutionM?: number;
  verticalDatum?: string;
  uncertaintyM?: number;
}

/** Bundled Mapzen Terrarium DEM under public/dem-tiles (offline). */
export const BUNDLED_DEM_TILES = "/dem-tiles/{z}/{x}/{y}.png";
export const BUNDLED_DEM_MIN_ZOOM = 5;
export const BUNDLED_DEM_MAX_ZOOM = 11;

/** Terrarium RGB → meters AMSL (Mapzen encoding). */
export function decodeTerrariumRgb(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

function lonLatToTileFrac(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
}

export interface TerrainAdapter {
  id: string;
  label: string;
  sample(lat: number, lng: number): Promise<TerrainSample>;
}

/** Default adapter: no DEM loaded. */
export const emptyTerrainAdapter: TerrainAdapter = {
  id: "none",
  label: "Нет DEM",
  async sample(lat, lng) {
    return {
      latitude: lat,
      longitude: lng,
      elevationM: null,
      sourceId: null,
      missing: true,
    };
  },
};

/**
 * Synthetic grid only for Simulation / unit tests — never presented as measured DEM.
 * Production path uses GeoTIFF adapter when file is loaded.
 */
export function buildLinearProfile(opts: {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  steps: number;
  antennaCenterAmslM: number | null;
  sample: (lat: number, lng: number) => Promise<TerrainSample>;
}): Promise<TerrainProfilePoint[]> {
  const { startLat, startLng, endLat, endLng, steps, antennaCenterAmslM, sample } = opts;
  const n = Math.max(2, steps);
  const approxDistM = haversineM(startLat, startLng, endLat, endLng);
  return Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const t = i / (n - 1);
      const lat = startLat + (endLat - startLat) * t;
      const lng = startLng + (endLng - startLng) * t;
      const s = await sample(lat, lng);
      return {
        distanceM: approxDistM * t,
        surfaceElevationM: s.elevationM,
        antennaCenterAmslM,
        missing: s.missing,
      };
    }),
  );
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

let active: TerrainAdapter = emptyTerrainAdapter;
let meta: DemSourceMeta = { id: "none", name: "Нет данных", sourceType: "none" };

export function getTerrainAdapter(): TerrainAdapter {
  return active;
}

export function getDemMeta(): DemSourceMeta {
  return meta;
}

export function setTerrainAdapter(adapter: TerrainAdapter, source: DemSourceMeta): void {
  active = adapter;
  meta = source;
}

/** Manual elevation entry adapter (operator-provided), clearly labeled. */
export function createManualElevationAdapter(
  points: Map<string, number>,
): TerrainAdapter {
  return {
    id: "manual",
    label: "Ручные отметки",
    async sample(lat, lng) {
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const elevationM = points.get(key) ?? null;
      return {
        latitude: lat,
        longitude: lng,
        elevationM,
        sourceId: "manual",
        missing: elevationM == null,
      };
    },
  };
}

/** GeoTIFF DEM via Rust sampler (uncompressed Float32/Int16 + geo tags). */
export function createGeoTiffAdapter(path: string): TerrainAdapter {
  return {
    id: "geotiff",
    label: `GeoTIFF ${path}`,
    async sample(lat, lng) {
      const { invoke } = await import("@tauri-apps/api/core");
      const { isTauriRuntime } = await import("@/services/tauri");
      if (!isTauriRuntime()) {
        return {
          latitude: lat,
          longitude: lng,
          elevationM: null,
          sourceId: null,
          missing: true,
        };
      }
      const s = await invoke<{
        elevationM?: number | null;
        missing: boolean;
        message: string;
      }>("terrain_sample_elevation", {
        path,
        latitude: lat,
        longitude: lng,
      });
      return {
        latitude: lat,
        longitude: lng,
        elevationM: s.elevationM ?? null,
        sourceId: "geotiff",
        missing: s.missing || s.elevationM == null,
      };
    },
  };
}

type TilePixels = { w: number; h: number; data: Uint8ClampedArray };

/**
 * Offline Terrarium PNG tiles (Mapzen encoding) — used for MapLibre 3D
 * and elevation sampling without Rust GeoTIFF.
 */
export function createTerrariumTileAdapter(opts?: {
  template?: string;
  zoom?: number;
  label?: string;
}): TerrainAdapter {
  const template = opts?.template ?? BUNDLED_DEM_TILES;
  const zoom = Math.min(
    BUNDLED_DEM_MAX_ZOOM,
    Math.max(BUNDLED_DEM_MIN_ZOOM, opts?.zoom ?? 10),
  );
  const cache = new Map<string, Promise<TilePixels | null>>();

  async function loadTile(z: number, x: number, y: number): Promise<TilePixels | null> {
    const key = `${z}/${x}/${y}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = (async () => {
        const url = template
          .replace("{z}", String(z))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          const bmp = await createImageBitmap(blob);
          const canvas = document.createElement("canvas");
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return null;
          ctx.drawImage(bmp, 0, 0);
          const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
          bmp.close();
          return { w: img.width, h: img.height, data: img.data };
        } catch {
          return null;
        }
      })();
      cache.set(key, pending);
    }
    return pending;
  }

  return {
    id: "terrarium",
    label: opts?.label ?? "Terrarium DEM (офлайн)",
    async sample(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return {
          latitude: lat,
          longitude: lng,
          elevationM: null,
          sourceId: null,
          missing: true,
        };
      }
      const { x, y } = lonLatToTileFrac(lng, lat, zoom);
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      const tile = await loadTile(zoom, tx, ty);
      if (!tile) {
        return {
          latitude: lat,
          longitude: lng,
          elevationM: null,
          sourceId: "terrarium",
          missing: true,
        };
      }
      const px = Math.min(tile.w - 1, Math.max(0, Math.floor((x - tx) * tile.w)));
      const py = Math.min(tile.h - 1, Math.max(0, Math.floor((y - ty) * tile.h)));
      const i = (py * tile.w + px) * 4;
      const elevationM = decodeTerrariumRgb(
        tile.data[i]!,
        tile.data[i + 1]!,
        tile.data[i + 2]!,
      );
      // Void / ocean sentinel in some tiles
      if (!Number.isFinite(elevationM) || elevationM < -500) {
        return {
          latitude: lat,
          longitude: lng,
          elevationM: null,
          sourceId: "terrarium",
          missing: true,
        };
      }
      return {
        latitude: lat,
        longitude: lng,
        elevationM: Math.round(elevationM * 10) / 10,
        sourceId: "terrarium",
        missing: false,
      };
    },
  };
}

/** Probe bundled DEM and register Terrarium adapter when tiles exist. */
export async function registerBundledTerrariumDem(): Promise<boolean> {
  try {
    const probe = await fetch(
      BUNDLED_DEM_TILES.replace("{z}", "8")
        .replace("{x}", "154")
        .replace("{y}", "79"),
      { method: "HEAD" },
    );
    // Some hosts ignore HEAD — fall back to GET of manifest
    if (!probe.ok) {
      const man = await fetch("/dem-tiles/manifest.json");
      if (!man.ok) return false;
    }
  } catch {
    try {
      const man = await fetch("/dem-tiles/manifest.json");
      if (!man.ok) return false;
    } catch {
      return false;
    }
  }
  if (active.id !== "none" && active.id !== "terrarium") {
    // Keep operator-loaded GeoTIFF / manual
    return false;
  }
  setTerrainAdapter(createTerrariumTileAdapter({ zoom: 10 }), {
    id: "bundled-terrarium",
    name: "Terrarium · Смоленск / Центральная Россия (офлайн)",
    sourceType: "terrarium",
    path: BUNDLED_DEM_TILES,
    resolutionM: 30,
    verticalDatum: "EGM96-approx (Terrarium)",
    uncertaintyM: 10,
  });
  return true;
}
