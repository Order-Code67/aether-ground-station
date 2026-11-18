import { create } from "zustand";
import type { Complex, Site } from "@/services/complexes";
import type { Station } from "@/services/stations";
import {
  listComplexes,
  listSites,
  upsertComplex,
  upsertSite,
} from "@/services/complexes";
import {
  listAntennaMounts,
  listAntennaProfiles,
} from "@/services/catalogs";
import {
  calcAntennaCenterAmsl,
  listStations,
  upsertStation,
} from "@/services/stations";
import { eventBus } from "@/services/events/eventBus";
import { clampAngle, destinationPoint } from "@/utils/geo";

export type PanTiltMode = "simulation" | "monitoring" | "local-status";

export interface PanTiltRanges {
  azMin: number;
  azMax: number;
  elMin: number;
  elMax: number;
}

export interface LookAtPoint {
  lat: number;
  lng: number;
}

export interface MapUserPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

/** Default look-at distance along azimuth when B not picked (m). */
export const DEFAULT_LOOK_AT_M = 2500;

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

interface PlannerState {
  complexes: Complex[];
  sites: Site[];
  stations: Station[];
  activeComplexId: string | null;
  activeSiteId: string | null;
  activeStationId: string | null;
  loading: boolean;
  error: string | null;

  /** Pan-tilt simulation / monitoring coordinator (UI SSOT for angles). */
  panTiltMode: PanTiltMode;
  simAzimuthDeg: number;
  simElevationDeg: number;
  /** Fact angles from adapter — null = Н/Д */
  factAzimuthDeg: number | null;
  factElevationDeg: number | null;
  panTiltRanges: PanTiltRanges;
  lookAt: LookAtPoint | null;
  /** When true, next map click sets look-at B. */
  pickLookAt: boolean;
  /** Operator range ring (km) around active station. */
  rangeKm: number;
  showRangeRing: boolean;
  /** Geometric radio-horizon lobe from DEM (not measured RF). */
  showRadioHorizon: boolean;
  /** Horizontal beamwidth of video patch (°) — map sector. */
  videoPatchDeg: number;
  /** Horizontal beamwidth of control/RC patch (°) — map sector. */
  controlPatchDeg: number;
  /** When true, next map click moves / creates НСУ (point A). */
  pickStationPos: boolean;
  /** When true, next map click adds a free user point. */
  pickMarker: boolean;
  /** Free operator points on the map (not НСУ / not цель B). */
  mapMarkers: MapUserPoint[];
  /** Show DEM flight-corridor clearance along heading. */
  showFlightCorridor: boolean;
  treeCollapsed: boolean;
  cardCollapsed: boolean;
  engineeringCollapsed: boolean;

  refresh: () => Promise<void>;
  setActiveComplexId: (id: string | null) => void;
  setActiveSiteId: (id: string | null) => void;
  setActiveStationId: (id: string | null) => void;
  saveComplex: (c: Complex) => Promise<void>;
  saveSite: (s: Site) => Promise<void>;
  saveStation: (s: Station) => Promise<void>;

  setPanTiltMode: (mode: PanTiltMode) => void;
  setSimAzimuthDeg: (deg: number) => void;
  setSimElevationDeg: (deg: number) => void;
  resetSimZero: () => void;
  setPanTiltRanges: (r: Partial<PanTiltRanges>) => void;
  setFactAngles: (
    az: number | null,
    el: number | null,
  ) => void;
  setLookAt: (p: LookAtPoint | null) => void;
  setPickLookAt: (v: boolean) => void;
  setRangeKm: (km: number) => void;
  setShowRangeRing: (v: boolean) => void;
  setShowRadioHorizon: (v: boolean) => void;
  setVideoPatchDeg: (deg: number) => void;
  setControlPatchDeg: (deg: number) => void;
  setPickStationPos: (v: boolean) => void;
  setPickMarker: (v: boolean) => void;
  addMapMarker: (lat: number, lng: number, label?: string) => void;
  removeMapMarker: (id: string) => void;
  clearMapMarkers: () => void;
  setShowFlightCorridor: (v: boolean) => void;
  /** Manual mast height (m) — persists on active station, updates AMSL / corridor. */
  setMastHeightM: (m: number) => Promise<void>;
  /** Move active station to lat/lng (working point). */
  moveActiveStation: (lat: number, lng: number) => Promise<void>;
  /**
   * Place НСУ at lat/lng: creates a working station if none selected,
   * otherwise moves the active one. No tree selection required.
   */
  placeOrMoveNsu: (lat: number, lng: number) => Promise<Station>;
  /** Apply saved aiming preset (point, AZ/EL, range, patches, mast). */
  applyAimingPreset: (p: {
    latitude: number;
    longitude: number;
    azimuthDeg: number;
    elevationDeg: number;
    rangeKm: number;
    videoPatchDeg: number;
    controlPatchDeg: number;
    mastHeightM: number;
  }) => Promise<void>;
  /** Pull beamwidthDeg from station antenna mounts — no invented RF. */
  applyPatchesFromCatalog: () => Promise<string>;
  /** Rebuild look-at B from active station + sim azimuth (keeps distance). */
  syncLookAtFromAzimuth: () => void;
  setTreeCollapsed: (v: boolean) => void;
  setCardCollapsed: (v: boolean) => void;
  setEngineeringCollapsed: (v: boolean) => void;
}

const DEFAULT_RANGES: PanTiltRanges = {
  azMin: -120,
  azMax: 120,
  elMin: 0,
  elMax: 90,
};

export const useStationPlannerStore = create<PlannerState>((set, get) => ({
  complexes: [],
  sites: [],
  stations: [],
  activeComplexId: null,
  activeSiteId: null,
  activeStationId: null,
  loading: false,
  error: null,

  panTiltMode: "simulation",
  simAzimuthDeg: 0,
  simElevationDeg: 0,
  factAzimuthDeg: null,
  factElevationDeg: null,
  panTiltRanges: { ...DEFAULT_RANGES },
  lookAt: null,
  pickLookAt: false,
  rangeKm: 40,
  showRangeRing: true,
  showRadioHorizon: true,
  videoPatchDeg: 60,
  controlPatchDeg: 90,
  pickStationPos: false,
  pickMarker: false,
  mapMarkers: [],
  showFlightCorridor: true,
  treeCollapsed: false,
  cardCollapsed: false,
  engineeringCollapsed: false,

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

  setActiveStationId: (id) => {
    const st = get().stations.find((s) => s.id === id);
    set({ activeStationId: id });
    if (st?.azimuthDeg != null) {
      const { azMin, azMax } = get().panTiltRanges;
      set({ simAzimuthDeg: clampAngle(st.azimuthDeg, azMin, azMax) });
    }
    if (st?.elevationDeg != null) {
      const { elMin, elMax } = get().panTiltRanges;
      set({ simElevationDeg: clampAngle(st.elevationDeg, elMin, elMax) });
    }
    // Seed look-at along azimuth when station selected and no B yet.
    if (st && !get().lookAt) {
      const az = get().simAzimuthDeg;
      const b = destinationPoint(
        st.latitude,
        st.longitude,
        az,
        DEFAULT_LOOK_AT_M,
      );
      set({ lookAt: b });
    } else if (st) {
      get().syncLookAtFromAzimuth();
    }
  },

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

  setPanTiltMode: (mode) => {
    if (mode === "monitoring" || mode === "local-status") {
      set({
        panTiltMode: mode,
        factAzimuthDeg: null,
        factElevationDeg: null,
      });
      return;
    }
    set({ panTiltMode: mode });
  },

  setSimAzimuthDeg: (deg) => {
    const { azMin, azMax } = get().panTiltRanges;
    set({ simAzimuthDeg: clampAngle(deg, azMin, azMax) });
    get().syncLookAtFromAzimuth();
  },

  setSimElevationDeg: (deg) => {
    const { elMin, elMax } = get().panTiltRanges;
    set({ simElevationDeg: clampAngle(deg, elMin, elMax) });
  },

  resetSimZero: () => {
    set({ simAzimuthDeg: 0, simElevationDeg: 0 });
    get().syncLookAtFromAzimuth();
  },

  setPanTiltRanges: (r) => {
    const next = { ...get().panTiltRanges, ...r };
    set({
      panTiltRanges: next,
      simAzimuthDeg: clampAngle(get().simAzimuthDeg, next.azMin, next.azMax),
      simElevationDeg: clampAngle(
        get().simElevationDeg,
        next.elMin,
        next.elMax,
      ),
    });
  },

  setFactAngles: (az, el) =>
    set({ factAzimuthDeg: az, factElevationDeg: el }),

  setLookAt: (p) => set({ lookAt: p, pickLookAt: false }),

  setPickLookAt: (v) =>
    set({
      pickLookAt: v,
      pickStationPos: v ? false : get().pickStationPos,
      pickMarker: v ? false : get().pickMarker,
    }),

  setRangeKm: (km) =>
    set({ rangeKm: Math.min(300, Math.max(1, Number.isFinite(km) ? km : 40)) }),

  setShowRangeRing: (v) => set({ showRangeRing: v }),

  setShowRadioHorizon: (v) => set({ showRadioHorizon: v }),

  setVideoPatchDeg: (deg) =>
    set({
      videoPatchDeg: Math.min(180, Math.max(5, Number.isFinite(deg) ? deg : 60)),
    }),

  setControlPatchDeg: (deg) =>
    set({
      controlPatchDeg: Math.min(
        180,
        Math.max(5, Number.isFinite(deg) ? deg : 90),
      ),
    }),

  setPickStationPos: (v) =>
    set({
      pickStationPos: v,
      pickLookAt: v ? false : get().pickLookAt,
      pickMarker: v ? false : get().pickMarker,
    }),

  setPickMarker: (v) =>
    set({
      pickMarker: v,
      pickLookAt: v ? false : get().pickLookAt,
      pickStationPos: v ? false : get().pickStationPos,
    }),

  addMapMarker: (lat, lng, label) => {
    const n = get().mapMarkers.length + 1;
    set({
      mapMarkers: [
        ...get().mapMarkers,
        {
          id: nid("pt"),
          lat,
          lng,
          label: label?.trim() || `Точка ${n}`,
        },
      ],
      pickMarker: false,
    });
  },

  removeMapMarker: (id) =>
    set({ mapMarkers: get().mapMarkers.filter((m) => m.id !== id) }),

  clearMapMarkers: () => set({ mapMarkers: [] }),

  setShowFlightCorridor: (v) => set({ showFlightCorridor: v }),

  setMastHeightM: async (m) => {
    const { activeStationId, stations } = get();
    const st = stations.find((s) => s.id === activeStationId);
    if (!st) return;
    const height = Math.min(120, Math.max(1, Number.isFinite(m) ? m : 15));
    await get().saveStation({ ...st, mastHeightM: height });
  },

  moveActiveStation: async (lat, lng) => {
    await get().placeOrMoveNsu(lat, lng);
  },

  placeOrMoveNsu: async (lat, lng) => {
    const { activeStationId, stations, activeComplexId, activeSiteId } = get();
    let elev: number | null = null;
    try {
      const { getTerrainAdapter, registerBundledTerrariumDem } = await import(
        "@/services/terrain/terrainEngine"
      );
      await registerBundledTerrariumDem();
      const s = await getTerrainAdapter().sample(lat, lng);
      if (!s.missing && s.elevationM != null) elev = s.elevationM;
    } catch {
      /* DEM optional */
    }

    // Prefer moving an existing station — never spawn a second «НСУ» beside «Станция 1».
    const existing =
      stations.find((s) => s.id === activeStationId) ??
      (stations.length === 1 ? stations[0]! : null) ??
      stations.find((s) => /нсу|station|станц/i.test(s.name)) ??
      null;

    const commitLocal = (st: Station, isNew: boolean) => {
      const list = get().stations;
      const i = list.findIndex((x) => x.id === st.id);
      const nextList =
        i < 0 ? [...list, st] : list.map((x, idx) => (idx === i ? st : x));
      if (isNew) {
        const b = destinationPoint(
          lat,
          lng,
          get().simAzimuthDeg,
          DEFAULT_LOOK_AT_M,
        );
        set({
          stations: nextList,
          activeStationId: st.id,
          pickStationPos: false,
          lookAt: b,
        });
      } else {
        set({
          stations: nextList,
          activeStationId: st.id,
          pickStationPos: false,
        });
        get().syncLookAtFromAzimuth();
      }
    };

    if (existing) {
      const terrainElevationM = elev ?? existing.terrainElevationM ?? null;
      const next: Station = {
        ...existing,
        latitude: lat,
        longitude: lng,
        terrainElevationM,
        antennaCenterAmslM: calcAntennaCenterAmsl(
          terrainElevationM,
          existing.mastHeightM,
          existing.antennaOffsetM,
        ),
        updatedAt: new Date().toISOString(),
      };
      try {
        await upsertStation(next);
        await get().refresh();
        set({ activeStationId: next.id, pickStationPos: false });
        get().syncLookAtFromAzimuth();
      } catch (e) {
        commitLocal(next, false);
        eventBus.emit(
          "warning",
          "map",
          e instanceof Error
            ? `НСУ сдвинута локально: ${e.message}`
            : "НСУ сдвинута локально (без записи в БД)",
        );
      }
      return next;
    }

    const st: Station = {
      id: nid("stn"),
      complexId: activeComplexId,
      siteId: activeSiteId,
      name: "НСУ",
      status: "active",
      latitude: lat,
      longitude: lng,
      terrainElevationM: elev,
      mastHeightM: 15,
      antennaOffsetM: 0,
      antennaCenterAmslM: calcAntennaCenterAmsl(elev, 15, 0),
      payload: "{}",
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertStation(st);
      await get().refresh();
      const b = destinationPoint(
        lat,
        lng,
        get().simAzimuthDeg,
        DEFAULT_LOOK_AT_M,
      );
      set({
        activeStationId: st.id,
        pickStationPos: false,
        lookAt: b,
      });
    } catch (e) {
      commitLocal(st, true);
      eventBus.emit(
        "warning",
        "map",
        e instanceof Error
          ? `НСУ создана локально: ${e.message}`
          : "НСУ создана локально (без записи в БД)",
      );
    }
    return st;
  },

  applyAimingPreset: async (p) => {
    const { activeStationId, stations, panTiltRanges } = get();
    const st = stations.find((s) => s.id === activeStationId);
    set({
      simAzimuthDeg: clampAngle(
        p.azimuthDeg,
        panTiltRanges.azMin,
        panTiltRanges.azMax,
      ),
      simElevationDeg: clampAngle(
        p.elevationDeg,
        panTiltRanges.elMin,
        panTiltRanges.elMax,
      ),
      rangeKm: Math.min(300, Math.max(1, p.rangeKm)),
      videoPatchDeg: Math.min(180, Math.max(5, p.videoPatchDeg)),
      controlPatchDeg: Math.min(180, Math.max(5, p.controlPatchDeg)),
    });
    if (st) {
      await get().saveStation({
        ...st,
        latitude: p.latitude,
        longitude: p.longitude,
        mastHeightM: p.mastHeightM,
        azimuthDeg: p.azimuthDeg,
        elevationDeg: p.elevationDeg,
      });
      get().syncLookAtFromAzimuth();
    }
  },

  applyPatchesFromCatalog: async () => {
    const { activeStationId } = get();
    if (!activeStationId) return "Станция не выбрана";
    const [mounts, antennas] = await Promise.all([
      listAntennaMounts(activeStationId),
      listAntennaProfiles(),
    ]);
    const byId = new Map(antennas.map((a) => [a.id, a]));
    const beams: { label: string; deg: number }[] = [];
    for (const m of mounts) {
      if (!m.antennaProfileId) continue;
      const a = byId.get(m.antennaProfileId);
      if (a?.beamwidthDeg == null || Number.isNaN(a.beamwidthDeg)) continue;
      beams.push({
        label: (m.label ?? a.name ?? "").toLowerCase(),
        deg: a.beamwidthDeg,
      });
    }
    if (!beams.length) {
      return "В каталоге нет beamwidthDeg у антенн этой станции (Н/Д)";
    }
    const video =
      beams.find((b) => /video|вид|патч.?в/i.test(b.label)) ?? beams[0]!;
    const control =
      beams.find((b) => /control|управ|rc|команд/i.test(b.label)) ??
      (beams.length > 1 ? beams[1]! : null);
    set({ videoPatchDeg: Math.min(180, Math.max(5, video.deg)) });
    if (control) {
      set({ controlPatchDeg: Math.min(180, Math.max(5, control.deg)) });
      return `Патчи из каталога: видео ${video.deg}° · управление ${control.deg}°`;
    }
    return `Патч видео из каталога: ${video.deg}° (управление без beamwidth — не менялся)`;
  },

  syncLookAtFromAzimuth: () => {
    const { activeStationId, stations, simAzimuthDeg, lookAt } = get();
    const st = stations.find((s) => s.id === activeStationId);
    if (!st) return;
    const dist =
      lookAt != null
        ? Math.max(
            50,
            Math.hypot(
              // approximate meters via degree delta — prefer previous haversine via lookAt distance
              (lookAt.lat - st.latitude) * 111_320,
              (lookAt.lng - st.longitude) *
                111_320 *
                Math.cos((st.latitude * Math.PI) / 180),
            ),
          )
        : DEFAULT_LOOK_AT_M;
    const b = destinationPoint(
      st.latitude,
      st.longitude,
      simAzimuthDeg,
      dist,
    );
    set({ lookAt: b });
  },

  setTreeCollapsed: (v) => set({ treeCollapsed: v }),
  setCardCollapsed: (v) => set({ cardCollapsed: v }),
  setEngineeringCollapsed: (v) => set({ engineeringCollapsed: v }),
}));
