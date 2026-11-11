import { useEffect, useState } from "react";
import type { Complex, Site } from "@/services/complexes";
import type { Station } from "@/services/stations";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useAuthStore } from "@/stores/authStore";
import { StatusBadge } from "@/components/common/StatusBadge";

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

/** Left pane: complex → site → station tree for unified planner. */
export function PlannerTree() {
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
    loading,
  } = useStationPlannerStore();

  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeSite = sites.find((s) => s.id === activeSiteId);
  const q = filter.trim().toLowerCase();
  const shownComplexes = complexes.filter(
    (c) => !q || c.name.toLowerCase().includes(q),
  );

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
    <div className="flex h-full min-h-0 flex-col gap-2 p-2 text-xs">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ags-muted">
        Объекты комплекса
      </div>
      <input
        className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
        placeholder="Поиск…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Поиск объектов"
      />
      <div className="flex gap-1">
        <input
          className="min-w-0 flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1"
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
      {loading && <p className="text-ags-dim">Загрузка…</p>}
      <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
        {shownComplexes.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${
                c.id === activeComplexId
                  ? "bg-ags-accent/20 text-ags-fg"
                  : "hover:bg-ags-elevated"
              }`}
              onClick={() => setActiveComplexId(c.id)}
            >
              <span className="truncate font-medium">{c.name}</span>
              <StatusBadge
                status={c.status === "active" ? "online" : "not_configured"}
              />
            </button>
            {c.id === activeComplexId && (
              <div className="ml-2 mt-1 space-y-1 border-l border-ags-border-subtle pl-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={!can}
                    className="rounded border border-ags-border px-1.5 py-0.5 disabled:opacity-40"
                    onClick={() => void addSite()}
                  >
                    + площадка
                  </button>
                  <button
                    type="button"
                    disabled={!can}
                    className="rounded border border-ags-border px-1.5 py-0.5 disabled:opacity-40"
                    onClick={() => void addStation()}
                  >
                    + станция
                  </button>
                </div>
                {sites.map((s) => (
                  <div key={s.id}>
                    <button
                      type="button"
                      className={`w-full truncate rounded px-1.5 py-0.5 text-left ${
                        s.id === activeSiteId
                          ? "bg-ags-accent/15"
                          : "hover:bg-ags-elevated"
                      }`}
                      onClick={() => setActiveSiteId(s.id)}
                    >
                      {s.name}
                    </button>
                  </div>
                ))}
                {stations.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left ${
                      st.id === activeStationId
                        ? "bg-ags-accent/25 font-medium"
                        : "hover:bg-ags-elevated"
                    }`}
                    onClick={() => setActiveStationId(st.id)}
                  >
                    {st.name}
                    {st.mastHeightM != null
                      ? ` · мачта ${st.mastHeightM} м`
                      : ""}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
