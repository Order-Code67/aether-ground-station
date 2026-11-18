import { useEffect, useState } from "react";
import {
  deleteComplex,
  deleteSite,
  type Complex,
  type Site,
} from "@/services/complexes";
import { deleteStation, type Station } from "@/services/stations";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useAuthStore } from "@/stores/authStore";
import { StatusBadge } from "@/components/common/StatusBadge";

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export function ComplexesPanel() {
  const can = useAuthStore((s) => s.can("manageDevices"));
  const {
    complexes,
    sites,
    stations,
    activeComplexId,
    activeSiteId,
    activeStationId,
    setActiveComplexId,
    setActiveSiteId,
    setActiveStationId,
    refresh,
    saveComplex,
    saveSite,
    saveStation,
    error,
    loading,
  } = useStationPlannerStore();

  const [name, setName] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeComplex = complexes.find((c) => c.id === activeComplexId);
  const activeSite = sites.find((s) => s.id === activeSiteId);
  const activeStation = stations.find((s) => s.id === activeStationId);

  const addComplex = async () => {
    if (!can || !name.trim()) return;
    const c: Complex = {
      id: nid("cpx"),
      name: name.trim(),
      status: "active",
      payload: "{}",
      updatedAt: new Date().toISOString(),
    };
    await saveComplex(c);
    setActiveComplexId(c.id);
    setName("");
  };

  const addSite = async () => {
    if (!can || !activeComplexId) return;
    const s: Site = {
      id: nid("site"),
      complexId: activeComplexId,
      name: `Площадка ${sites.length + 1}`,
      status: "unknown",
      payload: "{}",
      updatedAt: new Date().toISOString(),
    };
    await saveSite(s);
    setActiveSiteId(s.id);
  };

  const addStation = async () => {
    if (!can || !activeComplexId) return;
    const st: Station = {
      id: nid("stn"),
      complexId: activeComplexId,
      siteId: activeSiteId,
      name: `Станция ${stations.length + 1}`,
      status: "unknown",
      latitude: activeSite?.latitude ?? 55.75,
      longitude: activeSite?.longitude ?? 37.62,
      terrainElevationM: null,
      mastHeightM: null,
      antennaOffsetM: null,
      antennaCenterAmslM: null,
      payload: "{}",
      updatedAt: new Date().toISOString(),
    };
    await saveStation(st);
    setActiveStationId(st.id);
  };

  return (
    <div className="flex h-full min-h-0 gap-3 p-3 text-sm">
      <div className="flex w-64 shrink-0 flex-col gap-2 overflow-auto">
        <div className="flex gap-1">
          <input
            className="min-w-0 flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1 text-xs"
            placeholder="Новый комплекс"
            disabled={!can}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            disabled={!can}
            className="rounded bg-ags-accent px-2 py-1 text-white disabled:opacity-40"
            onClick={() => void addComplex()}
          >
            +
          </button>
        </div>
        <ul className="space-y-1">
          {complexes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`w-full rounded border px-2 py-1.5 text-left ${
                  c.id === activeComplexId
                    ? "border-ags-accent bg-ags-elevated"
                    : "border-ags-border"
                }`}
                onClick={() => setActiveComplexId(c.id)}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-[10px] text-ags-dim">{c.status}</div>
              </button>
            </li>
          ))}
        </ul>
        {activeComplexId && (
          <div className="space-y-1 border-t border-ags-border pt-2">
            <div className="flex items-center justify-between text-xs text-ags-muted">
              <span>Площадки</span>
              <button
                type="button"
                disabled={!can}
                className="text-ags-accent disabled:opacity-40"
                onClick={() => void addSite()}
              >
                + площадка
              </button>
            </div>
            {sites.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`w-full rounded border px-2 py-1 text-left text-xs ${
                  s.id === activeSiteId
                    ? "border-ags-accent bg-ags-elevated"
                    : "border-ags-border"
                }`}
                onClick={() => setActiveSiteId(s.id)}
              >
                {s.name}
              </button>
            ))}
            <div className="flex items-center justify-between pt-1 text-xs text-ags-muted">
              <span>Станции</span>
              <button
                type="button"
                disabled={!can}
                className="text-ags-accent disabled:opacity-40"
                onClick={() => void addStation()}
              >
                + станция
              </button>
            </div>
            {stations.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`w-full rounded border px-2 py-1 text-left text-xs ${
                  st.id === activeStationId
                    ? "border-ags-accent bg-ags-elevated"
                    : "border-ags-border"
                }`}
                onClick={() => setActiveStationId(st.id)}
              >
                {st.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-auto rounded border border-ags-border bg-ags-panel p-4">
        {loading && <p className="text-ags-dim">Загрузка…</p>}
        {error && <p className="text-ags-danger">{error}</p>}
        {!activeComplex && (
          <p className="text-ags-muted">
            Complex Manager: создайте или выберите комплекс. Данные разных
            комплексов не смешиваются при активном фильтре.
          </p>
        )}
        {activeComplex && !activeSite && !activeStation && (
          <div className="grid max-w-lg grid-cols-[8rem_1fr] gap-2">
            <label className="text-ags-dim">Название</label>
            <input
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!can}
              value={activeComplex.name}
              onChange={(e) =>
                void saveComplex({ ...activeComplex, name: e.target.value })
              }
            />
            <label className="text-ags-dim">Статус</label>
            <input
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!can}
              value={activeComplex.status}
              onChange={(e) =>
                void saveComplex({ ...activeComplex, status: e.target.value })
              }
            />
            <label className="text-ags-dim">Регион</label>
            <input
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!can}
              value={activeComplex.region ?? ""}
              onChange={(e) =>
                void saveComplex({
                  ...activeComplex,
                  region: e.target.value || null,
                })
              }
            />
            {can && (
              <button
                type="button"
                className="col-span-2 mt-2 w-fit rounded border border-ags-danger/40 px-2 py-1 text-ags-danger"
                onClick={() =>
                  void (async () => {
                    if (!confirm("Удалить комплекс?")) return;
                    await deleteComplex(activeComplex.id);
                    setActiveComplexId(null);
                    await refresh();
                  })()
                }
              >
                Удалить комплекс
              </button>
            )}
          </div>
        )}
        {activeSite && !activeStation && (
          <div className="grid max-w-lg grid-cols-[8rem_1fr] gap-2">
            <h2 className="col-span-2 font-medium">Площадка</h2>
            <label className="text-ags-dim">Название</label>
            <input
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!can}
              value={activeSite.name}
              onChange={(e) =>
                void saveSite({ ...activeSite, name: e.target.value })
              }
            />
            <label className="text-ags-dim">Адрес</label>
            <input
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              disabled={!can}
              value={activeSite.address ?? ""}
              onChange={(e) =>
                void saveSite({
                  ...activeSite,
                  address: e.target.value || null,
                })
              }
            />
            <label className="text-ags-dim">Широта</label>
            <input
              type="number"
              step="0.00001"
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              disabled={!can}
              value={activeSite.latitude ?? ""}
              onChange={(e) =>
                void saveSite({
                  ...activeSite,
                  latitude: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <label className="text-ags-dim">Долгота</label>
            <input
              type="number"
              step="0.00001"
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono"
              disabled={!can}
              value={activeSite.longitude ?? ""}
              onChange={(e) =>
                void saveSite({
                  ...activeSite,
                  longitude:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            {can && (
              <button
                type="button"
                className="col-span-2 mt-2 w-fit rounded border border-ags-danger/40 px-2 py-1 text-ags-danger"
                onClick={() =>
                  void (async () => {
                    if (!confirm("Удалить площадку?")) return;
                    await deleteSite(activeSite.id);
                    setActiveSiteId(null);
                    await refresh();
                  })()
                }
              >
                Удалить площадку
              </button>
            )}
          </div>
        )}
        {activeStation && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="font-medium">{activeStation.name}</h2>
              <StatusBadge
                status={
                  activeStation.antennaCenterAmslM == null
                    ? "not_available"
                    : "online"
                }
              />
            </div>
            <p className="font-mono text-xs text-ags-dim">
              {activeStation.latitude.toFixed(5)},{" "}
              {activeStation.longitude.toFixed(5)} · AMSL{" "}
              {activeStation.antennaCenterAmslM == null
                ? "N/A"
                : `${activeStation.antennaCenterAmslM.toFixed(1)} м`}
            </p>
            <p className="text-xs text-ags-muted">
              Редактирование координат и мачты — вкладка «Станции» / Карта и
              планирование.
            </p>
            {can && (
              <button
                type="button"
                className="rounded border border-ags-danger/40 px-2 py-1 text-ags-danger"
                onClick={() =>
                  void (async () => {
                    if (!confirm("Удалить станцию?")) return;
                    await deleteStation(activeStation.id);
                    setActiveStationId(null);
                    await refresh();
                  })()
                }
              >
                Удалить станцию
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
