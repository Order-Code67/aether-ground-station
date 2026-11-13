import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useNavigationStore } from "@/stores/navigationStore";

/** Right pane: selected station summary (honest Н/Д). */
export function StationCard() {
  const {
    complexes,
    sites,
    stations,
    activeComplexId,
    activeSiteId,
    activeStationId,
    simAzimuthDeg,
    simElevationDeg,
    panTiltMode,
  } = useStationPlannerStore();
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);

  const complex = complexes.find((c) => c.id === activeComplexId);
  const site = sites.find((s) => s.id === activeSiteId);
  const st = stations.find((s) => s.id === activeStationId);

  if (!st) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-xs text-ags-muted">
        Выберите станцию в дереве или на карте
      </div>
    );
  }

  const nd = (v: number | null | undefined, unit = "") =>
    v == null || Number.isNaN(v) ? "Н/Д" : `${v.toFixed(1)}${unit}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ags-fg">{st.name}</h3>
          <p className="text-ags-muted">
            {complex?.name ?? "—"} · {site?.name ?? "площадка не выбрана"}
          </p>
        </div>
        <StatusBadge
          status={
            st.status === "online"
              ? "online"
              : st.status === "error"
                ? "error"
                : "not_configured"
          }
        />
      </div>

      <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1 rounded border border-ags-border bg-ags-elevated/60 p-2">
        <dt className="text-ags-dim">Широта</dt>
        <dd className="font-mono">{st.latitude.toFixed(5)}</dd>
        <dt className="text-ags-dim">Долгота</dt>
        <dd className="font-mono">{st.longitude.toFixed(5)}</dd>
        <dt className="text-ags-dim">Рельеф</dt>
        <dd className="font-mono">{nd(st.terrainElevationM, " м")}</dd>
        <dt className="text-ags-dim">Мачта</dt>
        <dd className="font-mono">{nd(st.mastHeightM, " м")}</dd>
        <dt className="text-ags-dim">Offset</dt>
        <dd className="font-mono">{nd(st.antennaOffsetM, " м")}</dd>
        <dt className="text-ags-dim">AMSL ант.</dt>
        <dd className="font-mono">{nd(st.antennaCenterAmslM, " м")}</dd>
        <dt className="text-ags-dim">Профиль мачты</dt>
        <dd>{st.mastType ?? "Н/Д"}</dd>
        <dt className="text-ags-dim">Антенна</dt>
        <dd>{st.antennaType ?? "Н/Д"}</dd>
      </dl>

      <div className="rounded border border-ags-border bg-ags-elevated/40 p-2">
        <div className="mb-1 text-[11px] font-semibold uppercase text-ags-muted">
          Ориентация ({panTiltMode === "simulation" ? "симуляция" : "мониторинг"})
        </div>
        <div className="flex gap-4 font-mono text-sm">
          <span>AZ {simAzimuthDeg.toFixed(1)}°</span>
          <span>EL {simElevationDeg.toFixed(1)}°</span>
        </div>
        <p className="mt-1 text-[10px] text-ags-dim">
          Фактические углы с датчика — только при подключённом адаптере (иначе
          Н/Д). Команды на приводы не отправляются.
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-1 pt-2">
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1 hover:bg-ags-elevated"
          onClick={() => navigateToModule("stations")}
        >
          Карточка станции
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1 hover:bg-ags-elevated"
          onClick={() => navigateToModule("catalogs")}
        >
          Мачты / антенны
        </button>
      </div>
    </div>
  );
}
