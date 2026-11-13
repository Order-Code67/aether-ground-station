import { create } from "zustand";

/**
 * GS-10 cross-module selection sync — complex / site / station shared ids.
 * Planner store remains SSOT for station objects; this mirrors ids for other modules.
 */
interface SelectionState {
  complexId: string | null;
  siteId: string | null;
  stationId: string | null;
  setComplexId: (id: string | null) => void;
  setSiteId: (id: string | null) => void;
  setStationId: (id: string | null) => void;
  syncFromPlanner: (p: {
    complexId: string | null;
    siteId: string | null;
    stationId: string | null;
  }) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  complexId: null,
  siteId: null,
  stationId: null,
  setComplexId: (id) => set({ complexId: id, siteId: null, stationId: null }),
  setSiteId: (id) => set({ siteId: id, stationId: null }),
  setStationId: (id) => set({ stationId: id }),
  syncFromPlanner: (p) =>
    set({
      complexId: p.complexId,
      siteId: p.siteId,
      stationId: p.stationId,
    }),
}));
