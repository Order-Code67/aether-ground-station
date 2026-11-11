import { useEffect, useState } from "react";
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
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { haversineM } from "@/utils/geo";

export function TerrainPanel({
  coupled = false,
  compact = false,
}: {
  /** A = active station, B = look-at; rebuild when az/lookAt change. */
  coupled?: boolean;
  compact?: boolean;
}) {
  const [profile, setProfile] = useState<TerrainProfilePoint[]>([]);
  const [meta, setMeta] = useState(() => getDemMeta());
  const [manualElev, setManualElev] = useState("");
  const [geotiffPath, setGeotiffPath] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [startLat, setStartLat] = useState("55.75");
  const [startLng, setStartLng] = useState("37.62");
  const [endLat, setEndLat] = useState("55.80");
  const [endLng, setEndLng] = useState("37.70");

  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const lookAt = useStationPlannerStore((s) => s.lookAt);
  const simAz = useStationPlannerStore((s) => s.simAzimuthDeg);
  const st = stations.find((s) => s.id === activeStationId);

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

  const runProfile = async (
    sLat: number,
    sLng: number,
    eLat: number,
    eLng: number,
    antennaAmsl: number | null,
  ) => {
    if ([sLat, sLng, eLat, eLng].some((n) => Number.isNaN(n))) {
      setNote("Координаты A–B некорректны");
      return;
    }
    if (manualElev.trim() !== "") {
      const v = Number(manualElev);
      if (!Number.isNaN(v)) {
        const points = new Map<string, number>();
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
      steps: compact ? 16 : 24,
      antennaCenterAmslM: antennaAmsl,
      sample: (lat, lng) => adapter.sample(lat, lng),
    });
    setProfile(pts);
    const missing = pts.filter((p) => p.missing).length;
    const dist = haversineM(
      { lat: sLat, lng: sLng },
      { lat: eLat, lng: eLng },
    );
    setNote(
      missing === pts.length
        ? `DEM отсутствует — профиль Н/Д (${(dist / 1000).toFixed(2)} км). Геометрия ≠ радиосвязь.`
        : `Профиль ${(dist / 1000).toFixed(2)} км: ${pts.length - missing}/${pts.length} с данными · ${meta.name}`,
    );
    emitDomain(
      "TerrainDataLoaded",
      "terrain",
      `Профиль: missing=${missing}/${pts.length}`,
      { missing, total: pts.length },
    );
  };

  // GS-5: auto-couple A=station, B=look-at when azimuth / lookAt change.
  useEffect(() => {
    if (!coupled || !st || !lookAt) return;
    setStartLat(String(st.latitude));
    setStartLng(String(st.longitude));
    setEndLat(String(lookAt.lat));
    setEndLng(String(lookAt.lng));
    void runProfile(
      st.latitude,
      st.longitude,
      lookAt.lat,
      lookAt.lng,
      st.antennaCenterAmslM ?? null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupled, st?.id, st?.latitude, st?.longitude, lookAt?.lat, lookAt?.lng, simAz]);

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

  const w = compact ? 280 : 320;
  const h = compact ? 64 : 80;
  const known = profile.filter((p) => p.surfaceElevationM != null);
  const minE = known.length
    ? Math.min(...known.map((p) => p.surfaceElevationM!))
    : 0;
  const maxE = known.length
    ? Math.max(...known.map((p) => p.surfaceElevationM!))
    : 1;
  const span = maxE - minE || 1;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-2 text-sm">
      <p className="text-[10px] text-ags-muted">
        Рельеф · {meta.name} ({meta.sourceType})
        {coupled ? " · связан с азимутом / точкой B" : ""}. Не прогноз радиоканала.
      </p>
      {!compact && (
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono text-xs"
            placeholder="Путь к GeoTIFF"
            value={geotiffPath}
            onChange={(e) => setGeotiffPath(e.target.value)}
          />
          <button
            type="button"
            className="rounded border border-ags-border px-2 py-1 text-xs"
            onClick={() => void inspectGeoTiff()}
          >
            Inspect GeoTIFF
          </button>
        </div>
      )}
      {!coupled && (
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
        </div>
      )}
      {coupled && st && lookAt && (
        <p className="font-mono text-[10px] text-ags-dim">
          A={st.name} ({st.latitude.toFixed(4)},{st.longitude.toFixed(4)}) → B (
          {lookAt.lat.toFixed(4)},{lookAt.lng.toFixed(4)}) · AZ {simAz.toFixed(1)}°
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        {!coupled && (
          <>
            <input
              className="w-28 rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              placeholder="Ручная AMSL"
              value={manualElev}
              onChange={(e) => setManualElev(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-ags-accent px-2 py-1 text-white"
              onClick={() =>
                void runProfile(
                  Number(startLat),
                  Number(startLng),
                  Number(endLat),
                  Number(endLng),
                  st?.antennaCenterAmslM ?? null,
                )
              }
            >
              Построить профиль
            </button>
          </>
        )}
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          disabled={!profile.length}
          onClick={exportCsv}
        >
          CSV
        </button>
      </div>
      {note && <p className="text-[10px] text-ags-warning">{note}</p>}
      {profile.length > 0 && (
        <svg
          width={w}
          height={h}
          className="rounded border border-ags-border bg-ags-elevated"
          aria-label="Профиль рельефа"
        >
          {profile.map((p, i) => {
            if (p.surfaceElevationM == null) return null;
            const x =
              (p.distanceM / (profile.at(-1)?.distanceM || 1)) * (w - 8) + 4;
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
      {!compact && (
        <ul className="max-h-28 overflow-auto font-mono text-[10px] text-ags-dim">
          {profile.map((p, i) => (
            <li key={i}>
              {p.distanceM.toFixed(0)} m · surface{" "}
              {p.surfaceElevationM == null
                ? "N/A"
                : p.surfaceElevationM.toFixed(1)}
              {p.missing ? " · missing" : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
