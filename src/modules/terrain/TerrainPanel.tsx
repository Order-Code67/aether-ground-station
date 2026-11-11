import { useState } from "react";
import {
  buildLinearProfile,
  getDemMeta,
  getTerrainAdapter,
  setTerrainAdapter,
  createManualElevationAdapter,
  createGeoTiffAdapter,
  type TerrainProfilePoint,
} from "@/services/terrain/terrainEngine";
import { emitDomain } from "@/services/events/domainEvents";
import { listStations } from "@/services/stations";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export function TerrainPanel() {
  const [profile, setProfile] = useState<TerrainProfilePoint[]>([]);
  const [meta, setMeta] = useState(() => getDemMeta());
  const [manualElev, setManualElev] = useState("");
  const [geotiffPath, setGeotiffPath] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [startLat, setStartLat] = useState("55.75");
  const [startLng, setStartLng] = useState("37.62");
  const [endLat, setEndLat] = useState("55.80");
  const [endLng, setEndLng] = useState("37.70");

  const inspectGeoTiff = async () => {
    if (!geotiffPath.trim()) return;
    if (!isTauriRuntime()) {
      setNote("GeoTIFF inspect только в desktop");
      return;
    }
    try {
      const info = await invoke<{
        validTiff: boolean;
        width?: number;
        height?: number;
        message: string;
        path: string;
      }>("terrain_inspect_geotiff", { path: geotiffPath.trim() });
      setNote(info.message);
      if (info.validTiff) {
        await invoke("terrain_register_source", {
          id: `dem_${Date.now().toString(36)}`,
          name: info.path,
          sourceType: "geotiff",
          path: info.path,
          resolutionM: null,
        });
        setTerrainAdapter(createGeoTiffAdapter(info.path), {
          id: "geotiff",
          name: info.path,
          sourceType: "geotiff",
          path: info.path,
        });
        setMeta({
          id: "geotiff",
          name: info.path,
          sourceType: "geotiff",
          path: info.path,
        });
        emitDomain("TerrainDataLoaded", "terrain", info.message, {
          width: info.width,
          height: info.height,
        });
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };

  const runProfile = async () => {
    const sLat = Number(startLat);
    const sLng = Number(startLng);
    const eLat = Number(endLat);
    const eLng = Number(endLng);
    if ([sLat, sLng, eLat, eLng].some((n) => Number.isNaN(n))) {
      setNote("Координаты A–B некорректны");
      return;
    }
    const stations = await listStations();
    const a = stations[0];
    const points = new Map<string, number>();
    if (manualElev.trim() !== "") {
      const v = Number(manualElev);
      if (!Number.isNaN(v)) {
        points.set(`${sLat.toFixed(5)},${sLng.toFixed(5)}`, v);
        setTerrainAdapter(createManualElevationAdapter(points), {
          id: "manual",
          name: "Ручная отметка оператора",
          sourceType: "custom",
          uncertaintyM: undefined,
        });
      }
    }
    const adapter = getTerrainAdapter();
    const pts = await buildLinearProfile({
      startLat: sLat,
      startLng: sLng,
      endLat: eLat,
      endLng: eLng,
      steps: 24,
      antennaCenterAmslM: a?.antennaCenterAmslM ?? null,
      sample: (lat, lng) => adapter.sample(lat, lng),
    });
    setProfile(pts);
    const missing = pts.filter((p) => p.missing).length;
    setNote(
      missing === pts.length
        ? "Все точки без DEM — N/A (не подставляем высоты). Геометрия ≠ радиосвязь."
        : `Профиль: ${pts.length - missing}/${pts.length} с данными · источник ${meta.name}`,
    );
    emitDomain(
      "TerrainDataLoaded",
      "terrain",
      `Профиль: missing=${missing}/${pts.length}`,
      { missing, total: pts.length },
    );
  };

  const exportCsv = () => {
    if (!profile.length) return;
    const lines = [
      "distance_m,surface_elevation_m,antenna_center_amsl_m,missing,source",
      ...profile.map(
        (p) =>
          `${p.distanceM},${p.surfaceElevationM ?? ""},${p.antennaCenterAmslM ?? ""},${p.missing},${meta.name}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrain-profile-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const w = 320;
  const h = 80;
  const known = profile.filter((p) => p.surfaceElevationM != null);
  const minE = known.length
    ? Math.min(...known.map((p) => p.surfaceElevationM!))
    : 0;
  const maxE = known.length
    ? Math.max(...known.map((p) => p.surfaceElevationM!))
    : 1;
  const span = maxE - minE || 1;

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-sm">
      <p className="text-xs text-ags-muted">
        Terrain Engine. Источник: <strong>{meta.name}</strong> ({meta.sourceType}
        ). Геометрический профиль ≠ прогноз радиоканала.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[14rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono text-xs"
          placeholder="Путь к GeoTIFF"
          value={geotiffPath}
          onChange={(e) => setGeotiffPath(e.target.value)}
        />
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={() => void inspectGeoTiff()}
        >
          Inspect GeoTIFF
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <label className="flex items-center gap-1">
          A lat
          <input
            className="w-24 rounded border border-ags-border bg-ags-elevated px-1 py-0.5 font-mono"
            value={startLat}
            onChange={(e) => setStartLat(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1">
          A lng
          <input
            className="w-24 rounded border border-ags-border bg-ags-elevated px-1 py-0.5 font-mono"
            value={startLng}
            onChange={(e) => setStartLng(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1">
          B lat
          <input
            className="w-24 rounded border border-ags-border bg-ags-elevated px-1 py-0.5 font-mono"
            value={endLat}
            onChange={(e) => setEndLat(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1">
          B lng
          <input
            className="w-24 rounded border border-ags-border bg-ags-elevated px-1 py-0.5 font-mono"
            value={endLng}
            onChange={(e) => setEndLng(e.target.value)}
          />
        </label>
        <input
          className="w-28 rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
          placeholder="Ручная AMSL"
          value={manualElev}
          onChange={(e) => setManualElev(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-ags-accent px-2 py-1 text-white"
          onClick={() => void runProfile()}
        >
          Построить профиль
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          disabled={!profile.length}
          onClick={exportCsv}
        >
          Экспорт CSV
        </button>
      </div>
      {note && <p className="text-xs text-ags-warning">{note}</p>}
      {profile.length > 0 && (
        <svg width={w} height={h} className="rounded border border-ags-border bg-ags-elevated">
          {profile.map((p, i) => {
            if (p.surfaceElevationM == null) return null;
            const x = (p.distanceM / (profile.at(-1)?.distanceM || 1)) * (w - 8) + 4;
            const y =
              h - 4 - ((p.surfaceElevationM - minE) / span) * (h - 12);
            return (
              <circle key={i} cx={x} cy={y} r={2} className="fill-ags-accent" />
            );
          })}
          {profile[0]?.antennaCenterAmslM != null && (
            <line
              x1={4}
              x2={w - 4}
              y1={
                h -
                4 -
                ((profile[0].antennaCenterAmslM - minE) / span) * (h - 12)
              }
              y2={
                h -
                4 -
                ((profile[0].antennaCenterAmslM - minE) / span) * (h - 12)
              }
              stroke="currentColor"
              className="text-ags-warning"
              strokeDasharray="4 2"
            />
          )}
        </svg>
      )}
      <ul className="max-h-40 overflow-auto font-mono text-[10px] text-ags-dim">
        {profile.map((p, i) => (
          <li key={i}>
            {p.distanceM.toFixed(0)} m · surface{" "}
            {p.surfaceElevationM == null ? "N/A" : p.surfaceElevationM.toFixed(1)}
            {p.missing ? " · missing" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
