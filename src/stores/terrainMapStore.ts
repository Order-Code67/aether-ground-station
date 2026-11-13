import { create } from "zustand";
import { dbGetJson, dbUpsertJson } from "@/services/database";
import { destinationPoint } from "@/utils/geo";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";

export type TerrainMapTab =
  | "map"
  | "3d"
  | "profile"
  | "telemetry"
  | "radio"
  | "antennas";

export type PanTiltControlMode = "manual" | "auto" | "hold" | "center";

export interface DemoDrone {
  lat: number;
  lng: number;
  /** AMSL if known; else AGL above DEM. */
  amslM: number | null;
  aglM: number;
  labeledDemo: true;
}

interface TerrainMapState {
  tab: TerrainMapTab;
  view3d: boolean;
  demoMode: boolean;
  demoDrone: DemoDrone | null;
  /** Live / last-known drone — null = нет данных (не подменять DEMO). */
  liveDrone: {
    lat: number;
    lng: number;
    amslM: number | null;
    aglM: number | null;
    at: string;
    stale: boolean;
  } | null;
  freqGhz: number;
  showRadius: boolean;
  showFresnel: boolean;
  showHeightLegend: boolean;
  controlMode: PanTiltControlMode;
  maxRangeKm: number;
  hydrated: boolean;

  setTab: (t: TerrainMapTab) => void;
  setView3d: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  setFreqGhz: (f: number) => void;
  setShowRadius: (v: boolean) => void;
  setShowFresnel: (v: boolean) => void;
  setShowHeightLegend: (v: boolean) => void;
  setControlMode: (m: PanTiltControlMode) => void;
  setMaxRangeKm: (km: number) => void;
  seedDemoDrone: () => void;
  setLiveDrone: (
    d: TerrainMapState["liveDrone"],
  ) => void;
  /** Effective target for LOS (live preferred unless demo forced). */
  effectiveDrone: () => {
    lat: number;
    lng: number;
    amslM: number | null;
    aglM: number | null;
    source: "live" | "demo" | "lookAt" | "none";
  };
  hydrate: () => Promise<void>;
  persist: () => void;
}

const SETTINGS_KEY = "terrain_map_settings";

export const useTerrainMapStore = create<TerrainMapState>((set, get) => ({
  tab: "map",
  view3d: false,
  demoMode: false,
  demoDrone: null,
  liveDrone: null,
  freqGhz: 5.8,
  showRadius: true,
  showFresnel: true,
  showHeightLegend: true,
  controlMode: "manual",
  maxRangeKm: 50,
  hydrated: false,

  setTab: (tab) => {
    set({ tab, view3d: tab === "3d" ? true : tab === "map" ? false : get().view3d });
    get().persist();
  },
  setView3d: (view3d) => {
    set({ view3d, tab: view3d ? "3d" : "map" });
    get().persist();
  },
  setDemoMode: (demoMode) => {
    if (!demoMode) {
      set({ demoMode: false, demoDrone: null });
    } else {
      set({ demoMode: true });
      get().seedDemoDrone();
    }
    get().persist();
  },
  setFreqGhz: (freqGhz) => {
    set({ freqGhz: Math.min(10, Math.max(0.1, freqGhz)) });
    get().persist();
  },
  setShowRadius: (showRadius) => {
    set({ showRadius });
    get().persist();
  },
  setShowFresnel: (showFresnel) => {
    set({ showFresnel });
    get().persist();
  },
  setShowHeightLegend: (showHeightLegend) => {
    set({ showHeightLegend });
    get().persist();
  },
  setControlMode: (controlMode) => {
    set({ controlMode });
    if (controlMode === "center") {
      useStationPlannerStore.getState().resetSimZero();
    }
    get().persist();
  },
  setMaxRangeKm: (maxRangeKm) => {
    const km = Math.min(300, Math.max(5, maxRangeKm));
    set({ maxRangeKm: km });
    const range = useStationPlannerStore.getState().rangeKm;
    if (range > km) useStationPlannerStore.getState().setRangeKm(km);
    get().persist();
  },

  seedDemoDrone: () => {
    const planner = useStationPlannerStore.getState();
    const st = planner.stations.find((s) => s.id === planner.activeStationId);
    const lat0 = st?.latitude ?? 54.782;
    const lng0 = st?.longitude ?? 32.045;
    const az = ((planner.simAzimuthDeg % 360) + 360) % 360;
    const dist = Math.min(planner.rangeKm * 1000 * 0.6, 12_450);
    const p = destinationPoint(lat0, lng0, az, dist);
    set({
      demoDrone: {
        lat: p.lat,
        lng: p.lng,
        amslM: 350,
        aglM: 230,
        labeledDemo: true,
      },
      demoMode: true,
    });
  },

  setLiveDrone: (liveDrone) => set({ liveDrone }),

  effectiveDrone: () => {
    const { demoMode, demoDrone, liveDrone } = get();
    // Live telemetry always wins when present and not in explicit DEMO.
    if (liveDrone && !demoMode) {
      return {
        lat: liveDrone.lat,
        lng: liveDrone.lng,
        amslM: liveDrone.amslM,
        aglM: liveDrone.aglM,
        source: "live" as const,
      };
    }
    if (demoMode && demoDrone) {
      return {
        lat: demoDrone.lat,
        lng: demoDrone.lng,
        amslM: demoDrone.amslM,
        aglM: demoDrone.aglM,
        source: "demo" as const,
      };
    }
    const planner = useStationPlannerStore.getState();
    let lookAt = planner.lookAt;
    if (!lookAt) {
      planner.syncLookAtFromAzimuth();
      lookAt = useStationPlannerStore.getState().lookAt;
    }
    if (lookAt) {
      return {
        lat: lookAt.lat,
        lng: lookAt.lng,
        amslM: null,
        aglM: null,
        source: "lookAt" as const,
      };
    }
    return {
      lat: 0,
      lng: 0,
      amslM: null,
      aglM: null,
      source: "none" as const,
    };
  },

  hydrate: async () => {
    const s = await dbGetJson<{
      demoMode?: boolean;
      freqGhz?: number;
      showRadius?: boolean;
      showFresnel?: boolean;
      showHeightLegend?: boolean;
      controlMode?: PanTiltControlMode;
      maxRangeKm?: number;
      view3d?: boolean;
    }>(SETTINGS_KEY, {});
    // DEMO off by default — work with station / look-at / live telemetry.
    set({
      demoMode: false,
      demoDrone: null,
      freqGhz: s.freqGhz ?? 5.8,
      showRadius: s.showRadius ?? true,
      showFresnel: s.showFresnel ?? true,
      showHeightLegend: s.showHeightLegend ?? true,
      controlMode: s.controlMode ?? "manual",
      maxRangeKm: s.maxRangeKm ?? 50,
      view3d: s.view3d ?? false,
      tab: s.view3d ? "3d" : "map",
      hydrated: true,
    });
    get().persist();
  },

  persist: () => {
    const s = get();
    void dbUpsertJson(SETTINGS_KEY, {
      demoMode: s.demoMode,
      freqGhz: s.freqGhz,
      showRadius: s.showRadius,
      showFresnel: s.showFresnel,
      showHeightLegend: s.showHeightLegend,
      controlMode: s.controlMode,
      maxRangeKm: s.maxRangeKm,
      view3d: s.view3d,
    });
  },
}));
