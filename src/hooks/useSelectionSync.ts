import { useEffect } from "react";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useSelectionStore } from "@/stores/selectionStore";

/** Keep selectionStore in sync with planner active complex/site/station. */
export function useSelectionSync(): void {
  const complexId = useStationPlannerStore((s) => s.activeComplexId);
  const siteId = useStationPlannerStore((s) => s.activeSiteId);
  const stationId = useStationPlannerStore((s) => s.activeStationId);
  const syncFromPlanner = useSelectionStore((s) => s.syncFromPlanner);

  useEffect(() => {
    syncFromPlanner({ complexId, siteId, stationId });
  }, [complexId, siteId, stationId, syncFromPlanner]);
}
