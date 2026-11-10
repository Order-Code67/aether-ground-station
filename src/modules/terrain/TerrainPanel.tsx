import { useState } from "react";
import {
  buildLinearProfile,
  getDemMeta,
  getTerrainAdapter,
  setTerrainAdapter,
  createManualElevationAdapter,
  type TerrainProfilePoint,
} from "@/services/terrain/terrainEngine";
import { emitDomain } from "@/services/events/domainEvents";
import { listStations } from "@/services/stations";

export function TerrainPanel() {
  const [profile, setProfile] = useState<TerrainProfilePoint[]>([]);
  const [meta] = useState(() => getDemMeta());
  const [manualElev, setManualElev] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const runProfile = async () => {
    const stations = await listStations();
    const a = stations[0];
    if (!a) {
      setNote("Нет станций — создайте в Station Planner");
      return;
    }
    const endLat = a.latitude + 0.05;
    const endLng = a.longitude + 0.05;
    const points = new Map<string, number>();
    if (manualElev.trim() !== "") {
      const v = Number(manualElev);
      if (!Number.isNaN(v)) {
        points.set(`${a.latitude.toFixed(5)},${a.longitude.toFixed(5)}`, v);
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
      startLat: a.latitude,
      startLng: a.longitude,
      endLat,
      endLng,
      steps: 24,
      antennaCenterAmslM: a.antennaCenterAmslM ?? null,
      sample: (lat, lng) => adapter.sample(lat, lng),
    });
    setProfile(pts);
    const missing = pts.filter((p) => p.missing).length;
    setNote(
      missing === pts.length
        ? "Все точки без DEM — N/A (не подставляем высоты)"
        : `Профиль: ${pts.length - missing}/${pts.length} с данными`,
    );
    emitDomain(
      "TerrainDataLoaded",
      "terrain",
      `Профиль: missing=${missing}/${pts.length}`,
      { missing, total: pts.length },
    );
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
          className="w-32 rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono text-xs"
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
