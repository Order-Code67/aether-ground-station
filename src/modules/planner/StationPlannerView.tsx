import { MapPanel } from "@/modules/map/MapPanel";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { PlannerTree } from "./PlannerTree";
import { StationCard } from "./StationCard";
import { EngineeringStrip } from "./EngineeringStrip";

/**
 * GS-3 Station Planner — map-first layout (mockup-aligned):
 * full-bleed map + floating glass side panels + bottom engineering strip.
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
      className="relative flex h-full min-h-0 w-full flex-col bg-ags-bg"
      data-testid="station-planner"
    >
      <div className="relative min-h-0 w-full flex-1">
        <MapPanel plannerMode />

        {/* Left glass: object tree */}
        <div className="pointer-events-none absolute bottom-3 left-3 top-14 z-20 flex flex-col gap-2">
          <div className="pointer-events-auto flex gap-1">
            <button
              type="button"
              className="ags-glass-btn"
              onClick={() => setTreeCollapsed(!treeCollapsed)}
            >
              {treeCollapsed ? "Объекты ▸" : "Объекты ▾"}
            </button>
            <button
              type="button"
              className="ags-glass-btn"
              onClick={() => setCardCollapsed(!cardCollapsed)}
            >
              {cardCollapsed ? "Карточка ▸" : "Карточка ▾"}
            </button>
            <button
              type="button"
              className="ags-glass-btn"
              onClick={() => setEngineeringCollapsed(!engineeringCollapsed)}
            >
              {engineeringCollapsed ? "Инженерия ▸" : "Инженерия ▾"}
            </button>
          </div>
          {!treeCollapsed && (
            <aside
              className="ags-glass-panel pointer-events-auto w-56 overflow-hidden"
              aria-label="Дерево объектов"
            >
              <div className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ags-accent">
                Объекты комплекса
              </div>
              <div className="max-h-[min(52vh,28rem)] overflow-auto">
                <PlannerTree />
              </div>
            </aside>
          )}
        </div>

        {/* Right glass: station card */}
        {!cardCollapsed && (
          <aside
            className="ags-glass-panel pointer-events-auto absolute bottom-3 right-3 top-14 z-20 w-64 overflow-auto"
            aria-label="Карточка станции"
          >
            <StationCard />
          </aside>
        )}
      </div>

      {!engineeringCollapsed && (
        <div
          className="z-10 h-52 shrink-0 border-t border-ags-border-subtle bg-ags-panel/95 backdrop-blur-md"
          aria-label="Инженерная панель"
        >
          <EngineeringStrip />
        </div>
      )}
    </div>
  );
}
