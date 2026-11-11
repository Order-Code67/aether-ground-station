import { MapPanel } from "@/modules/map/MapPanel";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { PlannerTree } from "./PlannerTree";
import { StationCard } from "./StationCard";
import { EngineeringStrip } from "./EngineeringStrip";

/**
 * GS-3 unified 4-pane Station Planner:
 * tree | map | station card
 * ---------------- engineering (terrain + pan-tilt + 3D)
 */
export function StationPlannerView() {
  const treeCollapsed = useStationPlannerStore((s) => s.treeCollapsed);
  const cardCollapsed = useStationPlannerStore((s) => s.cardCollapsed);
  const engineeringCollapsed = useStationPlannerStore(
    (s) => s.engineeringCollapsed,
  );
  const setTreeCollapsed = useStationPlannerStore((s) => s.setTreeCollapsed);
  const setCardCollapsed = useStationPlannerStore((s) => s.setCardCollapsed);
  const setEngineeringCollapsed = useStationPlannerStore(
    (s) => s.setEngineeringCollapsed,
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-ags-bg"
      data-testid="station-planner"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-ags-border-subtle bg-ags-surface/80 px-3 py-1.5 text-[10px] backdrop-blur-sm">
        <span className="font-semibold uppercase tracking-[0.14em] text-ags-accent">
          Station Planner
        </span>
        <button
          type="button"
          className="rounded border border-ags-border px-1.5 py-0.5"
          onClick={() => setTreeCollapsed(!treeCollapsed)}
        >
          {treeCollapsed ? "Дерево ▸" : "Дерево ▾"}
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-1.5 py-0.5"
          onClick={() => setCardCollapsed(!cardCollapsed)}
        >
          {cardCollapsed ? "Карточка ▸" : "Карточка ▾"}
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-1.5 py-0.5"
          onClick={() => setEngineeringCollapsed(!engineeringCollapsed)}
        >
          {engineeringCollapsed ? "Инженерия ▸" : "Инженерия ▾"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {!treeCollapsed && (
          <aside
            className="w-56 shrink-0 border-r border-ags-border-subtle bg-ags-panel"
            aria-label="Дерево объектов"
          >
            <PlannerTree />
          </aside>
        )}
        <div className="relative min-w-0 flex-1">
          <MapPanel plannerMode />
        </div>
        {!cardCollapsed && (
          <aside
            className="w-64 shrink-0 border-l border-ags-border-subtle bg-ags-panel"
            aria-label="Карточка станции"
          >
            <StationCard />
          </aside>
        )}
      </div>

      {!engineeringCollapsed && (
        <div
          className="h-56 shrink-0 border-t border-ags-border-subtle bg-ags-panel"
          aria-label="Инженерная панель"
        >
          <EngineeringStrip />
        </div>
      )}
    </div>
  );
}
