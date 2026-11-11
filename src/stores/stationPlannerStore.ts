import { create } from "zustand";
import type { Complex, Site } from "@/services/complexes";
import type { Station } from "@/services/stations";
import {
  listComplexes,
  listSites,
  upsertComplex,
  upsertSite,
} from "@/services/complexes";
import { listStations, upsertStation } from "@/services/stations";

interface PlannerState {
  complexes: Complex[];
  sites: Site[];
  stations: Station[];
  activeComplexId: string | null;
  activeSiteId: string | null;
  activeStationId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setActiveComplexId: (id: string | null) => void;
  setActiveSiteId: (id: string | null) => void;
  setActiveStationId: (id: string | null) => void;
  saveComplex: (c: Complex) => Promise<void>;
  saveSite: (s: Site) => Promise<void>;
  saveStation: (s: Station) => Promise<void>;
}

export const useStationPlannerStore = create<PlannerState>((set, get) => ({
  complexes: [],
  sites: [],
  stations: [],
  activeComplexId: null,
  activeSiteId: null,
  activeStationId: null,
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const { activeComplexId, activeSiteId } = get();
      const complexes = await listComplexes();
      const sites = await listSites(activeComplexId);
      const stations = await listStations({
        complexId: activeComplexId,
        siteId: activeSiteId,
      });
      set({ complexes, sites, stations, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  setActiveComplexId: (id) => {
    set({ activeComplexId: id, activeSiteId: null, activeStationId: null });
    void get().refresh();
  },

  setActiveSiteId: (id) => {
    set({ activeSiteId: id, activeStationId: null });
    void get().refresh();
  },

  setActiveStationId: (id) => set({ activeStationId: id }),

  saveComplex: async (c) => {
    await upsertComplex(c);
    await get().refresh();
  },

  saveSite: async (s) => {
    await upsertSite(s);
    await get().refresh();
  },

  saveStation: async (s) => {
    await upsertStation(s);
    await get().refresh();
  },
}));
