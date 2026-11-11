import { StationPlannerView } from "@/modules/planner";

/** Default planning map tab = unified 4-pane Station Planner (GS-3). */
export function MapView() {
  return <StationPlannerView />;
}

export { MapPanel } from "./MapPanel";
