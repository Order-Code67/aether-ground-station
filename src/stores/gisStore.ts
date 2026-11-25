import { create } from "zustand";
import {
  BUNDLED_OFFLINE_REGIONS,
  DEFAULT_LAYERS,
  loadGisWorkspace,
  nid,
  saveGisWorkspace,
} from "@/services/gis/gisStorage";
import type {
  GisLayerFlags,
  GisMeasureRecord,
  GisObstacle,
  GisRoute,
  GisRoutePoint,
  ObstacleKind,
  OfflineRegionMeta,
} from "@/services/gis/gisTypes";
import { haversineM, bearingDeg } from "@/utils/geo";
import { parseGisFile } from "@/services/gis/geoImport";

export type GisTool =
  | "none"
  | "measureDistance"
  | "measureArea"
  | "measureAzimuth"
  | "measureDeltaH"
  | "routeEdit"
  | "obstaclePlace"
  | "profilePickA"
  | "profilePickB";

interface GisState {
  layers: GisLayerFlags;
  verticalExaggeration: number;
  routes: GisRoute[];
  activeRouteId: string | null;
  obstacles: GisObstacle[];
  measures: GisMeasureRecord[];
  offlineRegions: OfflineRegionMeta[];
  tool: GisTool;
  measureDraft: { lat: number; lng: number }[];
  profileOverrideA: { lat: number; lng: number } | null;
  profileOverrideB: { lat: number; lng: number } | null;
  leftPanelOpen: boolean;
  bottomPanelOpen: boolean;
  hydrated: boolean;
  cursor: {
    lat: number;
    lng: number;
    elevM: number | null;
    source: string | null;
  } | null;

  hydrate: () => Promise<void>;
  persist: () => void;
  setLayer: <K extends keyof GisLayerFlags>(k: K, v: GisLayerFlags[K]) => void;
  setVerticalExaggeration: (v: number) => void;
  setTool: (t: GisTool) => void;
  setCursor: (c: GisState["cursor"]) => void;
  setLeftPanelOpen: (v: boolean) => void;
  setBottomPanelOpen: (v: boolean) => void;
  clearMeasureDraft: () => void;
  pushMeasurePoint: (lat: number, lng: number) => Promise<"needMore" | "done">;
  removeMeasure: (id: string) => void;
  createRoute: (name?: string) => string;
  setActiveRouteId: (id: string | null) => void;
  addRoutePoint: (lat: number, lng: number) => void;
  removeRoutePoint: (routeId: string, pointId: string) => void;
  deleteRoute: (id: string) => void;
  addObstacle: (opts: {
    lat: number;
    lng: number;
    kind: ObstacleKind;
    name?: string;
    heightM?: number | null;
  }) => void;
  removeObstacle: (id: string) => void;
  setProfileOverrideA: (p: { lat: number; lng: number } | null) => void;
  setProfileOverrideB: (p: { lat: number; lng: number } | null) => void;
  routeLengthM: (routeId: string) => number;
  importGisText: (filename: string, text: string) => string;
}

export const useGisStore = create<GisState>((set, get) => ({
  layers: { ...DEFAULT_LAYERS },
  verticalExaggeration: 1.8,
  routes: [],
  activeRouteId: null,
  obstacles: [],
  measures: [],
  offlineRegions: [...BUNDLED_OFFLINE_REGIONS],
  tool: "none",
  measureDraft: [],
  profileOverrideA: null,
  profileOverrideB: null,
  leftPanelOpen: true,
  bottomPanelOpen: true,
  hydrated: false,
  cursor: null,

  hydrate: async () => {
    const blob = await loadGisWorkspace();
    set({
      layers: { ...DEFAULT_LAYERS, ...blob.layers },
      verticalExaggeration: blob.verticalExaggeration ?? 1.8,
      routes: blob.routes ?? [],
      obstacles: blob.obstacles ?? [],
      measures: blob.measures ?? [],
      offlineRegions:
        blob.offlineRegions?.length
          ? blob.offlineRegions
          : [...BUNDLED_OFFLINE_REGIONS],
      leftPanelOpen: blob.leftPanelOpen ?? true,
      bottomPanelOpen: blob.bottomPanelOpen ?? true,
      hydrated: true,
    });
  },

  persist: () => {
    const s = get();
    void saveGisWorkspace({
      layers: s.layers,
      verticalExaggeration: s.verticalExaggeration,
      routes: s.routes,
      obstacles: s.obstacles,
      measures: s.measures,
      offlineRegions: s.offlineRegions,
      leftPanelOpen: s.leftPanelOpen,
      bottomPanelOpen: s.bottomPanelOpen,
    });
  },

  setLayer: (k, v) => {
    set({ layers: { ...get().layers, [k]: v } });
    get().persist();
  },

  setVerticalExaggeration: (v) => {
    set({
      verticalExaggeration: Math.min(6, Math.max(0.5, Number.isFinite(v) ? v : 1.8)),
    });
    get().persist();
  },

  setTool: (tool) => set({ tool, measureDraft: [] }),

  setCursor: (cursor) => set({ cursor }),

  setLeftPanelOpen: (leftPanelOpen) => {
    set({ leftPanelOpen });
    get().persist();
  },

  setBottomPanelOpen: (bottomPanelOpen) => {
    set({ bottomPanelOpen });
    get().persist();
  },

  clearMeasureDraft: () => set({ measureDraft: [] }),

  pushMeasurePoint: async (lat, lng) => {
    const { tool, measureDraft } = get();
    const next = [...measureDraft, { lat, lng }];
    set({ measureDraft: next });

    if (tool === "measureDistance" || tool === "measureAzimuth") {
      if (next.length < 2) return "needMore";
      const a = next[0]!;
      const b = next[1]!;
      const dist = haversineM(
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng },
      );
      const az = bearingDeg(
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng },
      );
      const rec: GisMeasureRecord =
        tool === "measureDistance"
          ? {
              id: nid("msr"),
              kind: "distance",
              label: "Расстояние",
              value: dist,
              unit: "m",
              at: new Date().toISOString(),
            }
          : {
              id: nid("msr"),
              kind: "azimuth",
              label: "Азимут",
              value: az,
              unit: "°",
              at: new Date().toISOString(),
            };
      set({
        measures: [rec, ...get().measures].slice(0, 40),
        measureDraft: [],
        tool: "none",
      });
      get().persist();
      return "done";
    }

    if (tool === "measureDeltaH") {
      if (next.length < 2) return "needMore";
      const { getTerrainAdapter } = await import(
        "@/services/terrain/terrainEngine"
      );
      const adapter = getTerrainAdapter();
      const sa = await adapter.sample(next[0]!.lat, next[0]!.lng);
      const sb = await adapter.sample(next[1]!.lat, next[1]!.lng);
      const va = sa.missing ? null : sa.elevationM;
      const vb = sb.missing ? null : sb.elevationM;
      if (va == null || vb == null) {
        set({ measureDraft: [], tool: "none" });
        return "done";
      }
      const deltaRec: GisMeasureRecord = {
        id: nid("msr"),
        kind: "deltaH",
        label: "Перепад высот",
        value: vb - va,
        unit: "m",
        at: new Date().toISOString(),
      };
      set({
        measures: [deltaRec, ...get().measures].slice(0, 40),
        measureDraft: [],
        tool: "none",
      });
      get().persist();
      return "done";
    }

    if (tool === "measureArea") {
      if (next.length < 3) return "needMore";
      const area = polygonAreaM2(next);
      const areaRec: GisMeasureRecord = {
        id: nid("msr"),
        kind: "area",
        label: "Площадь",
        value: area,
        unit: "m²",
        at: new Date().toISOString(),
      };
      set({
        measures: [areaRec, ...get().measures].slice(0, 40),
        measureDraft: [],
        tool: "none",
      });
      get().persist();
      return "done";
    }

    return "needMore";
  },

  removeMeasure: (id) => {
    set({ measures: get().measures.filter((m) => m.id !== id) });
    get().persist();
  },

  createRoute: (name) => {
    const id = nid("rte");
    const route: GisRoute = {
      id,
      name: name?.trim() || `Маршрут ${get().routes.length + 1}`,
      points: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      planningOnly: true,
    };
    set({
      routes: [...get().routes, route],
      activeRouteId: id,
      tool: "routeEdit",
    });
    get().persist();
    return id;
  },

  setActiveRouteId: (activeRouteId) => set({ activeRouteId }),

  addRoutePoint: (lat, lng) => {
    const { activeRouteId, routes } = get();
    if (!activeRouteId) return;
    const pt: GisRoutePoint = {
      id: nid("rp"),
      lat,
      lng,
      amslM: null,
      aglM: null,
    };
    set({
      routes: routes.map((r) =>
        r.id === activeRouteId
          ? {
              ...r,
              points: [...r.points, pt],
              updatedAt: new Date().toISOString(),
            }
          : r,
      ),
    });
    get().persist();
  },

  removeRoutePoint: (routeId, pointId) => {
    set({
      routes: get().routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              points: r.points.filter((p) => p.id !== pointId),
              updatedAt: new Date().toISOString(),
            }
          : r,
      ),
    });
    get().persist();
  },

  deleteRoute: (id) => {
    set({
      routes: get().routes.filter((r) => r.id !== id),
      activeRouteId: get().activeRouteId === id ? null : get().activeRouteId,
    });
    get().persist();
  },

  addObstacle: ({ lat, lng, kind, name, heightM }) => {
    const o: GisObstacle = {
      id: nid("obs"),
      name: name?.trim() || kindLabel(kind),
      kind,
      lat,
      lng,
      heightM: heightM ?? null,
      note: "",
      source: "operator",
      createdAt: new Date().toISOString(),
    };
    set({ obstacles: [...get().obstacles, o], tool: "none" });
    get().persist();
  },

  removeObstacle: (id) => {
    set({ obstacles: get().obstacles.filter((o) => o.id !== id) });
    get().persist();
  },

  setProfileOverrideA: (profileOverrideA) => set({ profileOverrideA }),
  setProfileOverrideB: (profileOverrideB) => set({ profileOverrideB }),

  importGisText: (filename, text) => {
    const parsed = parseGisFile(filename, text);
    const now = new Date().toISOString();
    const extraObstacles: GisObstacle[] = parsed.points.map((p) => ({
      id: nid("obs"),
      name: p.name,
      kind: "other" as const,
      lat: p.lat,
      lng: p.lng,
      heightM: null,
      note: `import ${filename}`,
      source: "import",
      createdAt: now,
    }));
    const extraRoutes: GisRoute[] = parsed.lines.map((line, i) => ({
      id: nid("rte"),
      name: line.name || `Импорт ${get().routes.length + i + 1}`,
      points: line.points.map((pt) => ({
        id: nid("rp"),
        lat: pt.lat,
        lng: pt.lng,
        amslM: null,
        aglM: null,
      })),
      createdAt: now,
      updatedAt: now,
      planningOnly: true as const,
    }));
    set({
      obstacles: [...get().obstacles, ...extraObstacles],
      routes: [...get().routes, ...extraRoutes],
      activeRouteId: extraRoutes[0]?.id ?? get().activeRouteId,
    });
    get().persist();
    return parsed.message;
  },

  routeLengthM: (routeId) => {
    const r = get().routes.find((x) => x.id === routeId);
    if (!r || r.points.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1]!;
      const b = r.points[i]!;
      sum += haversineM(
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng },
      );
    }
    return sum;
  },
}));

function kindLabel(k: ObstacleKind): string {
  switch (k) {
    case "tree":
      return "Дерево";
    case "building":
      return "Здание";
    case "tower":
      return "Вышка";
    case "mast":
      return "Мачта";
    case "hill":
      return "Холм";
    default:
      return "Объект";
  }
}

/** Spherical excess approximation for small polygons (m²). */
function polygonAreaM2(pts: { lat: number; lng: number }[]): number {
  if (pts.length < 3) return 0;
  const R = 6_371_000;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum +=
      ((b.lng * Math.PI) / 180 - (a.lng * Math.PI) / 180) *
      (2 +
        Math.sin((a.lat * Math.PI) / 180) +
        Math.sin((b.lat * Math.PI) / 180));
  }
  return Math.abs((sum * R * R) / 2);
}
