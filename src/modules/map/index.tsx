import { TerrainMapView } from "@/modules/terrainMap";

/**
 * Planning «Карта» tab = TZ Terrain Map (2D slippy + 3D DEM + Fresnel profile).
 * Station Planner glass layout remains available via aiming / antennas tab.
 */
export function MapView() {
  return <TerrainMapView />;
}

export { MapPanel } from "./MapPanel";
