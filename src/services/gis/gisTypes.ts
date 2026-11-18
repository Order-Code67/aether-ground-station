export interface GisRoutePoint {
  id: string;
  lat: number;
  lng: number;
  /** Planned AGL or AMSL — null = unknown (honest Н/Д). */
  amslM: number | null;
  aglM: number | null;
}

export interface GisRoute {
  id: string;
  name: string;
  points: GisRoutePoint[];
  createdAt: string;
  updatedAt: string;
  /** Planning only — never sent to aircraft. */
  planningOnly: true;
}

export type ObstacleKind =
  | "tree"
  | "building"
  | "tower"
  | "mast"
  | "hill"
  | "other";

export interface GisObstacle {
  id: string;
  name: string;
  kind: ObstacleKind;
  lat: number;
  lng: number;
  heightM: number | null;
  note: string;
  source: string;
  createdAt: string;
}

export interface GisMeasureRecord {
  id: string;
  kind: "distance" | "area" | "azimuth" | "deltaH";
  label: string;
  value: number;
  unit: string;
  at: string;
}

export interface OfflineRegionMeta {
  id: string;
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
  minZoom: number;
  maxZoom: number;
  layers: ("basemap" | "dem" | "labels")[];
  status: "bundled" | "ready" | "missing";
  note: string;
}

export interface GisLayerFlags {
  basemap: boolean;
  satellite: boolean;
  relief: boolean;
  demColormap: boolean;
  contours: boolean;
  station: boolean;
  drone: boolean;
  radius: boolean;
  antennaSector: boolean;
  los: boolean;
  fresnel: boolean;
  route: boolean;
  userPoints: boolean;
  obstacles: boolean;
  measurements: boolean;
  reliefOpacity: number;
  colormapOpacity: number;
}
