import { useCallback, useEffect, useState } from "react";
import {
  calcAntennaCenterAmsl,
  deleteStation,
  listStations,
  upsertStation,
  type Station,
} from "@/services/stations";
import { listComplexes, listSites, type Complex, type Site } from "@/services/complexes";
import { emitDomain } from "@/services/events/domainEvents";
import { useAuthStore } from "@/stores/authStore";
import { getTerrainAdapter } from "@/services/terrain/terrainEngine";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { CoordinatePlaceForm } from "@/modules/planner/CoordinatePlaceForm";
import { parseLatLonInput } from "@/services/planner/parseCoords";

function numOrEmpty(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "" : String(v);
}

export function StationsPanel() {
  const canManage = useAuthStore((s) => s.can("manageDevices"));
  const activeComplexId = useStationPlannerStore((s) => s.activeComplexId);
  const activeSiteId = useStationPlannerStore((s) => s.activeSiteId);
  const setActiveStationId = useStationPlannerStore((s) => s.setActiveStationId);

  const [stations, setStations] = useState<Station[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStations(
        await listStations({
          complexId: activeComplexId,
          siteId: activeSiteId,
        }),
      );
      setComplexes(await listComplexes());
      setSites(await listSites(activeComplexId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeComplexId, activeSiteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = stations.find((s) => s.id === selectedId) ?? null;

  const commitCoords = async (latRaw: string, lngRaw: string) => {
    if (!selected || !canManage) return;
    const r = parseLatLonInput(latRaw, lngRaw);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    const sample = await getTerrainAdapter().sample(r.lat, r.lng);
    const elev = !sample.missing && sample.elevationM != null ? sample.elevationM : null;
    await patch({
      latitude: r.lat,
      longitude: r.lng,
      terrainElevationM: elev,
    });
  };

  const patch = async (partial: Partial<Station>) => {
    if (!selected || !canManage) return;
    const next = { ...selected, ...partial };
    next.antennaCenterAmslM = calcAntennaCenterAmsl(
      next.terrainElevationM,
      next.mastHeightM,
      next.antennaOffsetM,
    );
    await upsertStation(next);
    emitDomain("StationUpdated", "stations", `Обновлена ${next.name}`);
    await refresh();
  };

  return (
    <div className="flex h-full min-h-0 gap-3 p-3 text-sm">
      <div className="flex w-56 shrink-0 flex-col gap-2">
        <div className={!canManage ? "pointer-events-none opacity-40" : ""}>
          <CoordinatePlaceForm />
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
          {stations.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`w-full rounded border px-2 py-1.5 text-left ${
                  s.id === selectedId
                    ? "border-ags-accent bg-ags-elevated"
                    : "border-ags-border"
                }`}
                onClick={() => {
                  setSelectedId(s.id);
                  setActiveStationId(s.id);
                }}
              >
                <div className="font-medium">{s.name}</div>
                <div className="font-mono text-[10px] text-ags-dim">
                  {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 flex-1 overflow-auto rounded border border-ags-border bg-ags-panel p-3">
        {error && <p className="mb-2 text-ags-danger">{error}</p>}
        {!selected ? (
          <p className="text-ags-muted">
            Station Planner: выберите станцию. Высота мачты неизвестна → N/A
            (не подставляем 0). Геометрия ≠ радиосвязь.
          </p>
        ) : (
          <div className="grid max-w-xl grid-cols-[9rem_1fr] gap-2">
            <label className="text-ags-dim">Название</label>
            <input
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!canManage}
              value={selected.name}
              onChange={(e) => void patch({ name: e.target.value })}
            />
            <label className="text-ags-dim">Комплекс</label>
            <select
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!canManage}
              value={selected.complexId ?? ""}
              onChange={(e) =>
                void patch({ complexId: e.target.value || null })
              }
            >
              <option value="">—</option>
              {complexes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="text-ags-dim">Площадка</label>
            <select
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!canManage}
              value={selected.siteId ?? ""}
              onChange={(e) => void patch({ siteId: e.target.value || null })}
            >
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="text-ags-dim">Широта</label>
            <input
              inputMode="decimal"
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              disabled={!canManage}
              defaultValue={selected.latitude}
              key={`${selected.id}-lat-${selected.latitude}`}
              onBlur={(e) =>
                void commitCoords(e.target.value, String(selected.longitude))
              }
            />
            <label className="text-ags-dim">Долгота</label>
            <input
              inputMode="decimal"
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              disabled={!canManage}
              defaultValue={selected.longitude}
              key={`${selected.id}-lng-${selected.longitude}`}
              onBlur={(e) =>
                void commitCoords(String(selected.latitude), e.target.value)
              }
            />
            <label className="text-ags-dim">Elevation AMSL</label>
            <div className="font-mono">
              {selected.terrainElevationM == null
                ? "N/A"
                : `${selected.terrainElevationM} м`}
            </div>
            <label className="text-ags-dim">Mast Height</label>
            <input
              type="number"
              step="0.1"
              placeholder="N/A"
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              disabled={!canManage}
              value={numOrEmpty(selected.mastHeightM)}
              onChange={(e) =>
                void patch({
                  mastHeightM:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <label className="text-ags-dim">Antenna Offset</label>
            <input
              type="number"
              step="0.1"
              placeholder="N/A"
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              disabled={!canManage}
              value={numOrEmpty(selected.antennaOffsetM)}
              onChange={(e) =>
                void patch({
                  antennaOffsetM:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <label className="text-ags-dim">Antenna Center AMSL</label>
            <div className="font-mono text-ags-accent">
              {selected.antennaCenterAmslM == null
                ? "N/A"
                : `${selected.antennaCenterAmslM.toFixed(2)} м`}
            </div>
            <label className="text-ags-dim">Азимут °</label>
            <input
              type="number"
              min={0}
              max={360}
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              disabled={!canManage}
              value={numOrEmpty(selected.azimuthDeg)}
              onChange={(e) =>
                void patch({
                  azimuthDeg:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <label className="text-ags-dim">Система азимута</label>
            <select
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!canManage}
              value={selected.azimuthRef ?? "true"}
              onChange={(e) => void patch({ azimuthRef: e.target.value })}
            >
              <option value="true">Истинный север</option>
              <option value="magnetic">Магнитный север</option>
            </select>
            {canManage && (
              <button
                type="button"
                className="col-span-2 mt-2 w-fit rounded border border-ags-danger/40 px-2 py-1 text-ags-danger"
                onClick={() =>
                  void (async () => {
                    await deleteStation(selected.id);
                    setSelectedId(null);
                    await refresh();
                  })()
                }
              >
                Удалить
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
