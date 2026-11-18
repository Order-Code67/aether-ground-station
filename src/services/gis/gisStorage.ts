import { dbGetJson, dbUpsertJson } from "@/services/database";
import type {
  GisLayerFlags,
  GisMeasureRecord,
  GisObstacle,
  GisRoute,
  OfflineRegionMeta,
} from "./gisTypes";

const KEY = "gis_workspace_v1";

export interface GisWorkspaceBlob {
  layers: GisLayerFlags;
  verticalExaggeration: number;
  routes: GisRoute[];
  obstacles: GisObstacle[];
  measures: GisMeasureRecord[];
  offlineRegions: OfflineRegionMeta[];
  leftPanelOpen: boolean;
  bottomPanelOpen: boolean;
}

export const DEFAULT_LAYERS: GisLayerFlags = {
  basemap: true,
  satellite: true,
  relief: true,
  demColormap: false,
  contours: false,
  station: true,
  drone: true,
  radius: true,
  antennaSector: true,
  los: true,
  fresnel: true,
  route: true,
  userPoints: true,
  obstacles: true,
  measurements: true,
  reliefOpacity: 0.55,
  colormapOpacity: 0.45,
};

/** Bundled Smolensk / Central Russia coverage — already on disk. */
export const BUNDLED_OFFLINE_REGIONS: OfflineRegionMeta[] = [
  {
    id: "bundled-smolensk",
    name: "Смоленск / Центральная Россия",
    west: 30.5,
    south: 51,
    east: 42,
    north: 58.5,
    minZoom: 5,
    maxZoom: 12,
    layers: ["basemap", "dem", "labels"],
    status: "bundled",
    note: "Тайлы в public/tiles + public/dem-tiles (офлайн).",
  },
];

export async function loadGisWorkspace(): Promise<Partial<GisWorkspaceBlob>> {
  return dbGetJson<Partial<GisWorkspaceBlob>>(KEY, {});
}

export async function saveGisWorkspace(
  blob: GisWorkspaceBlob,
): Promise<void> {
  await dbUpsertJson(KEY, blob);
}

export function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}
