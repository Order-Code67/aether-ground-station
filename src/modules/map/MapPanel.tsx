import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eventBus } from "@/services/events/eventBus";
import {
  listStations,
  upsertStation,
  type Station,
} from "@/services/stations";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useAuthStore } from "@/stores/authStore";
import { haversineM } from "@/utils/geo";
import {
  absoluteAssetUrl,
  BUNDLED_DEM_MAX_ZOOM,
  BUNDLED_DEM_MIN_ZOOM,
  BUNDLED_DEM_TILES,
  BUNDLED_LABEL_TILES,
  BUNDLED_OFFLINE_TILES,
  BUNDLED_STREET_LABEL_TILES,
  BUNDLED_STREET_TILES,
  CARTO_VOYAGER_LABELS,
  CARTO_VOYAGER_TILES,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  ESRI_IMAGERY_TILES,
} from "./mapStyles";
import { DemOverlayTile } from "./DemOverlayTile";
import { placesVisibleAtZoom } from "./places";
import { SafeTile } from "./SafeTile";
import { useGisStore } from "@/stores/gisStore";
import {
  destinationByAzimuth,
  lonLatToWorldPx,
  tile2lat,
  tile2lon,
  worldPxToLonLat,
} from "./slippyMath";
import {
  computeRadioHorizon,
  type HorizonResult,
} from "@/services/terrain/radioHorizon";
import {
  computeFlightCorridor,
  sectorPolygon,
  type CorridorResult,
} from "@/services/terrain/flightCorridor";
import { getTerrainAdapter } from "@/services/terrain/terrainEngine";
import { destinationPoint } from "@/utils/geo";
import { calcAntennaCenterAmsl } from "@/services/stations";
import { useTerrainMapStore } from "@/stores/terrainMapStore";

/**
 * offline — Esri satellite (bundled)
 * streets — CARTO Voyager streets+names (bundled offline pack)
 * hybrid — satellite + street-name overlay (offline pack / online fallback)
 * carto — CARTO Voyager online (detailed streets)
 * osm — OSM.org raster online
 * local — custom XYZ template
 */
type TileMode =
  | "offline"
  | "streets"
  | "hybrid"
  | "carto"
  | "osm"
  | "local";

const TILE = 256;
const MIN_Z = 2;
const MAX_Z_SAT_OFFLINE = 12;
const MAX_Z_STREETS_OFFLINE = 16;
const MAX_Z_ONLINE = 18;

function isOnlineMode(mode: TileMode): boolean {
  return mode === "carto" || mode === "osm";
}

function isStreetBasemap(mode: TileMode): boolean {
  return mode === "streets" || mode === "carto" || mode === "osm";
}

function templateFor(mode: TileMode, localUrl: string): string {
  if (mode === "carto") return CARTO_VOYAGER_TILES;
  if (mode === "osm") {
    return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  if (mode === "streets") {
    return absoluteAssetUrl(BUNDLED_STREET_TILES);
  }
  if (mode === "hybrid") {
    // Base = bundled satellite; street names come from overlay template.
    return absoluteAssetUrl(BUNDLED_OFFLINE_TILES);
  }
  if (mode === "local") {
    return absoluteAssetUrl(localUrl || BUNDLED_OFFLINE_TILES);
  }
  return absoluteAssetUrl(BUNDLED_OFFLINE_TILES);
}

function overlayLabelTemplate(mode: TileMode): string | null {
  if (mode === "hybrid") {
    return absoluteAssetUrl(BUNDLED_STREET_LABEL_TILES);
  }
  if (mode === "offline") {
    // Place names only (no streets) — keep legacy Esri labels.
    return absoluteAssetUrl(BUNDLED_LABEL_TILES);
  }
  if (mode === "streets") {
    // Full street basemap already includes names.
    return null;
  }
  return null;
}

/**
 * Offline-first slippy map (DOM tiles) — no MapLibre worker / WebGL.
 * Auto-loads when the Map section opens.
 */
export function MapPanel({ plannerMode = false }: { plannerMode?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    lon: number;
    lat: number;
  } | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState({
    lon: DEFAULT_MAP_CENTER[0],
    lat: DEFAULT_MAP_CENTER[1],
  });
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const [ready, setReady] = useState(false);
  const [tileStatus, setTileStatus] = useState<"pending" | "ok" | "fail">(
    "pending",
  );

  const [stations, setStations] = useState<Station[]>([]);
  const canManage = useAuthStore((s) => s.can("manageDevices"));
  const setActiveStationId = useStationPlannerStore((s) => s.setActiveStationId);
  const activeComplexId = useStationPlannerStore((s) => s.activeComplexId);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const simAzimuthDeg = useStationPlannerStore((s) => s.simAzimuthDeg);
  const lookAt = useStationPlannerStore((s) => s.lookAt);
  const pickLookAt = useStationPlannerStore((s) => s.pickLookAt);
  const pickStationPos = useStationPlannerStore((s) => s.pickStationPos);
  const pickMarker = useStationPlannerStore((s) => s.pickMarker);
  const mapMarkers = useStationPlannerStore((s) => s.mapMarkers);
  const setPickStationPos = useStationPlannerStore((s) => s.setPickStationPos);
  const setPickLookAt = useStationPlannerStore((s) => s.setPickLookAt);
  const setPickMarker = useStationPlannerStore((s) => s.setPickMarker);
  const placeOrMoveNsu = useStationPlannerStore((s) => s.placeOrMoveNsu);
  const removeStation = useStationPlannerStore((s) => s.removeStation);
  const addMapMarker = useStationPlannerStore((s) => s.addMapMarker);
  const removeMapMarker = useStationPlannerStore((s) => s.removeMapMarker);
  const plannerStations = useStationPlannerStore((s) => s.stations);
  const rangeKm = useStationPlannerStore((s) => s.rangeKm);
  const showRangeRing = useStationPlannerStore((s) => s.showRangeRing);
  const showRadioHorizon = useStationPlannerStore((s) => s.showRadioHorizon);
  const videoPatchDeg = useStationPlannerStore((s) => s.videoPatchDeg);
  const controlPatchDeg = useStationPlannerStore((s) => s.controlPatchDeg);
  const showFlightCorridor = useStationPlannerStore((s) => s.showFlightCorridor);
  const setRangeKm = useStationPlannerStore((s) => s.setRangeKm);
  const setShowRangeRing = useStationPlannerStore((s) => s.setShowRangeRing);
  const setShowRadioHorizon = useStationPlannerStore(
    (s) => s.setShowRadioHorizon,
  );
  const showRadiusPref = useTerrainMapStore((s) => s.showRadius);
  const droneEff = useTerrainMapStore((s) => s.effectiveDrone);

  const [measureMode, setMeasureMode] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);
  const [horizon, setHorizon] = useState<HorizonResult | null>(null);
  const [corridor, setCorridor] = useState<CorridorResult | null>(null);
  const [measureA, setMeasureA] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>("streets");
  const [localUrl, setLocalUrl] = useState(BUNDLED_OFFLINE_TILES);
  const [streetsOnlineFallback, setStreetsOnlineFallback] = useState(false);
  const layers = useGisStore((s) => s.layers);
  const setCursor = useGisStore((s) => s.setCursor);
  const gisTool = useGisStore((s) => s.tool);
  const pushMeasurePoint = useGisStore((s) => s.pushMeasurePoint);
  const addRoutePoint = useGisStore((s) => s.addRoutePoint);
  const addObstacle = useGisStore((s) => s.addObstacle);
  const setProfileOverrideA = useGisStore((s) => s.setProfileOverrideA);
  const setProfileOverrideB = useGisStore((s) => s.setProfileOverrideB);
  const setGisTool = useGisStore((s) => s.setTool);
  const routes = useGisStore((s) => s.routes);
  const obstacles = useGisStore((s) => s.obstacles);
  const measureDraft = useGisStore((s) => s.measureDraft);
  const verticalExaggeration = useGisStore((s) => s.verticalExaggeration);

  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;
  const pickLookAtRef = useRef(pickLookAt);
  pickLookAtRef.current = pickLookAt;
  const pickStationPosRef = useRef(pickStationPos);
  pickStationPosRef.current = pickStationPos;
  const pickMarkerRef = useRef(pickMarker);
  pickMarkerRef.current = pickMarker;

  const zMax = isOnlineMode(tileMode)
    ? MAX_Z_ONLINE
    : tileMode === "streets" || tileMode === "hybrid"
      ? MAX_Z_STREETS_OFFLINE
      : MAX_Z_SAT_OFFLINE;

  const tileTpl = useMemo(() => {
    if (tileMode === "streets" && streetsOnlineFallback) {
      return CARTO_VOYAGER_TILES;
    }
    if (tileMode === "hybrid" && streetsOnlineFallback) {
      return ESRI_IMAGERY_TILES;
    }
    return templateFor(tileMode, localUrl);
  }, [tileMode, localUrl, streetsOnlineFallback]);

  const overlayTpl = useMemo(() => {
    if (!labelsOn) return null;
    if (tileMode === "hybrid") {
      return streetsOnlineFallback
        ? CARTO_VOYAGER_LABELS
        : absoluteAssetUrl(BUNDLED_STREET_LABEL_TILES);
    }
    if (tileMode === "offline" && labelsOn) {
      return absoluteAssetUrl(BUNDLED_LABEL_TILES);
    }
    return overlayLabelTemplate(tileMode);
  }, [tileMode, labelsOn, streetsOnlineFallback]);

  // Size the host as soon as Map tab mounts — then map paints.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0) {
        setSize({ w, h });
        setReady(true);
      }
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(host);
    const t = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 250);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, []);

  // Probe basemap tiles when mode / ready changes.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setStreetsOnlineFallback(false);
    void (async () => {
      try {
        if (isOnlineMode(tileMode)) {
          if (cancelled) return;
          setTileStatus("ok");
          eventBus.emit(
            "info",
            "map",
            tileMode === "carto"
              ? "Карта: CARTO Voyager онлайн · улицы и названия"
              : "Карта: OSM онлайн",
          );
          return;
        }

        if (tileMode === "streets" || tileMode === "hybrid") {
          const probe =
            tileMode === "streets"
              ? absoluteAssetUrl("/tiles-streets/10/603/324.png")
              : absoluteAssetUrl("/tiles/10/603/324.jpg");
          const res = await fetch(probe);
          if (cancelled) return;
          if (res.ok) {
            setTileStatus("ok");
            setStreetsOnlineFallback(false);
            eventBus.emit(
              "info",
              "map",
              tileMode === "streets"
                ? "Карта: офлайн улицы (CARTO/OSM) · Смоленск"
                : "Карта: гибрид спутник + подписи улиц",
            );
          } else {
            // No offline street pack yet — fall back to free online CARTO/Esri.
            setStreetsOnlineFallback(true);
            setTileStatus("ok");
            eventBus.emit(
              "warning",
              "map",
              "Офлайн-улицы не найдены · онлайн CARTO Voyager (npm run tiles:streets)",
            );
          }
          return;
        }

        const probe = absoluteAssetUrl("/tiles/10/603/324.jpg");
        const res = await fetch(probe);
        if (cancelled) return;
        setTileStatus(res.ok ? "ok" : "fail");
        eventBus.emit(
          res.ok ? "info" : "warning",
          "map",
          res.ok
            ? "Карта: офлайн спутник Esri · Смоленск OK"
            : `Офлайн-тайл недоступен (${res.status})`,
        );
      } catch (e) {
        if (cancelled) return;
        if (tileMode === "streets" || tileMode === "hybrid") {
          setStreetsOnlineFallback(true);
          setTileStatus("ok");
          eventBus.emit(
            "warning",
            "map",
            "Офлайн-улицы недоступны · переключение на онлайн CARTO",
          );
          return;
        }
        setTileStatus("fail");
        eventBus.emit(
          "warning",
          "map",
          e instanceof Error ? e.message : "Тайл-проверка не удалась",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, tileMode]);

  useEffect(() => {
    void listStations({ complexId: activeComplexId })
      .then(setStations)
      .catch(() => setStations([]));
  }, [activeComplexId]);

  const displayStations = plannerMode ? plannerStations : stations;
  const active = displayStations.find((s) => s.id === activeStationId);

  // Resolve antenna AMSL from mast + DEM when stored AMSL missing.
  const resolveAntennaAmsl = useCallback(async (st: Station) => {
    const mast = st.mastHeightM ?? 15;
    const fromParts = calcAntennaCenterAmsl(
      st.terrainElevationM,
      mast,
      st.antennaOffsetM,
    );
    if (fromParts != null) return { antennaAmsl: fromParts, mast };
    if (st.antennaCenterAmslM != null) {
      return { antennaAmsl: st.antennaCenterAmslM, mast };
    }
    const s = await getTerrainAdapter().sample(st.latitude, st.longitude);
    if (s.elevationM != null) {
      return {
        antennaAmsl: s.elevationM + mast + (st.antennaOffsetM ?? 0),
        mast,
      };
    }
    return { antennaAmsl: null as number | null, mast };
  }, []);

  // Geometric radio-horizon lobe (DEM) — capped by operator range.
  useEffect(() => {
    if (!showRadioHorizon || !active) {
      setHorizon(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { antennaAmsl, mast } = await resolveAntennaAmsl(active);
      const result = await computeRadioHorizon({
        lat: active.latitude,
        lng: active.longitude,
        antennaAmslM: antennaAmsl,
        heightAglM: mast,
        rangeLimitM: rangeKm * 1000,
      });
      if (!cancelled) setHorizon(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    active,
    rangeKm,
    showRadioHorizon,
    resolveAntennaAmsl,
  ]);

  // DEM flight corridor along heading — updates when mast / AZ / range change.
  useEffect(() => {
    if (!plannerMode || !showFlightCorridor || !active) {
      setCorridor(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { antennaAmsl } = await resolveAntennaAmsl(active);
      const result = await computeFlightCorridor({
        lat: active.latitude,
        lng: active.longitude,
        bearingDeg: ((simAzimuthDeg % 360) + 360) % 360,
        antennaAmslM: antennaAmsl,
        rangeLimitM: rangeKm * 1000,
      });
      if (!cancelled) setCorridor(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    active,
    plannerMode,
    rangeKm,
    resolveAntennaAmsl,
    showFlightCorridor,
    simAzimuthDeg,
  ]);

  const project = useCallback(
    (lon: number, lat: number) => {
      const c = lonLatToWorldPx(center.lon, center.lat, zoom, TILE);
      const p = lonLatToWorldPx(lon, lat, zoom, TILE);
      return {
        x: size.w / 2 + (p.x - c.x),
        y: size.h / 2 + (p.y - c.y),
      };
    },
    [center.lat, center.lon, size.h, size.w, zoom],
  );

  const unproject = useCallback(
    (sx: number, sy: number) => {
      const c = lonLatToWorldPx(center.lon, center.lat, zoom, TILE);
      const wx = c.x + (sx - size.w / 2);
      const wy = c.y + (sy - size.h / 2);
      return worldPxToLonLat(wx, wy, zoom, TILE);
    },
    [center.lat, center.lon, size.h, size.w, zoom],
  );

  const buildTileGrid = useCallback(
    (tpl: string) => {
      if (size.w <= 0 || size.h <= 0) return [];
      const c = lonLatToWorldPx(center.lon, center.lat, zoom, TILE);
      const left = c.x - size.w / 2;
      const top = c.y - size.h / 2;
      const x0 = Math.floor(left / TILE) - 1;
      const y0 = Math.floor(top / TILE) - 1;
      const x1 = Math.floor((left + size.w) / TILE) + 1;
      const y1 = Math.floor((top + size.h) / TILE) + 1;
      const n = 2 ** zoom;
      const out: {
        key: string;
        left: number;
        top: number;
        url: string;
      }[] = [];
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          if (y < 0 || y >= n) continue;
          const tx = ((x % n) + n) % n;
          out.push({
            key: `${tpl}:${zoom}/${tx}/${y}`,
            left: x * TILE - left,
            top: y * TILE - top,
            url: tpl
              .replace("{z}", String(zoom))
              .replace("{x}", String(tx))
              .replace("{y}", String(y)),
          });
        }
      }
      return out;
    },
    [center.lat, center.lon, size.h, size.w, zoom],
  );

  const tiles = useMemo(() => buildTileGrid(tileTpl), [buildTileGrid, tileTpl]);
  const labelTiles = useMemo(
    () => (overlayTpl ? buildTileGrid(overlayTpl) : []),
    [buildTileGrid, overlayTpl],
  );
  const showBaseTiles = layers.satellite || isStreetBasemap(tileMode);
  const placeLabels = useMemo(() => placesVisibleAtZoom(zoom), [zoom]);

  /** DEM tiles for hillshade (clamp to bundled Terrarium zooms). */
  const demOverlayNeeded =
    layers.relief || layers.demColormap || layers.contours;

  const demTiles = useMemo(() => {
    if (!demOverlayNeeded || size.w <= 0 || size.h <= 0) return [];
    const demZ = Math.min(
      BUNDLED_DEM_MAX_ZOOM,
      Math.max(BUNDLED_DEM_MIN_ZOOM, zoom),
    );
    const c = lonLatToWorldPx(center.lon, center.lat, demZ, TILE);
    const left = c.x - size.w / 2 / 2 ** Math.max(0, zoom - demZ);
    const top = c.y - size.h / 2 / 2 ** Math.max(0, zoom - demZ);
    const span = Math.max(size.w, size.h) / 2 ** Math.max(0, zoom - demZ);
    const x0 = Math.floor(left / TILE) - 1;
    const y0 = Math.floor(top / TILE) - 1;
    const x1 = Math.floor((left + span) / TILE) + 1;
    const y1 = Math.floor((top + span) / TILE) + 1;
    const n = 2 ** demZ;
    const out: {
      key: string;
      left: number;
      top: number;
      size: number;
      url: string;
    }[] = [];
    const screenC = lonLatToWorldPx(center.lon, center.lat, zoom, TILE);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= n) continue;
        const tx = ((x % n) + n) % n;
        const url = absoluteAssetUrl(BUNDLED_DEM_TILES)
          .replace("{z}", String(demZ))
          .replace("{x}", String(tx))
          .replace("{y}", String(y));
        const lon0 = tile2lon(x, demZ);
        const lat0 = tile2lat(y, demZ);
        const lon1 = tile2lon(x + 1, demZ);
        const lat1 = tile2lat(y + 1, demZ);
        const p0 = lonLatToWorldPx(lon0, lat0, zoom, TILE);
        const p1 = lonLatToWorldPx(lon1, lat1, zoom, TILE);
        out.push({
          key: `dem-${demZ}/${tx}/${y}`,
          left: p0.x - (screenC.x - size.w / 2),
          top: p0.y - (screenC.y - size.h / 2),
          size: Math.max(1, Math.abs(p1.x - p0.x)),
          url,
        });
      }
    }
    return out;
  }, [center.lat, center.lon, demOverlayNeeded, size.h, size.w, zoom]);

  const cursorSampleRef = useRef(0);
  const onHostPointerMove = (e: React.PointerEvent) => {
    onPointerMove(e);
    const now = performance.now();
    if (now - cursorSampleRef.current < 80) return;
    cursorSampleRef.current = now;
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { lon, lat } = unproject(e.clientX - rect.left, e.clientY - rect.top);
    void (async () => {
      try {
        const { getTerrainAdapter, getDemMeta, registerBundledTerrariumDem } =
          await import("@/services/terrain/terrainEngine");
        await registerBundledTerrariumDem();
        const s = await getTerrainAdapter().sample(lat, lon);
        const meta = getDemMeta();
        setCursor({
          lat,
          lng: lon,
          elevM: s.missing ? null : s.elevationM,
          source: s.missing
            ? null
            : `${meta.name}${meta.resolutionM != null ? ` · ≈${meta.resolutionM} м` : ""}`,
        });
      } catch {
        setCursor({ lat, lng: lon, elevM: null, source: null });
      }
    })();
  };

  const movedRef = useRef(false);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.min(
      zMax,
      Math.max(MIN_Z, zoom + (e.deltaY > 0 ? -1 : 1)),
    );
    if (next === zoom) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) {
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const under = unproject(sx, sy);
      setZoom(next);
      setCenter({ lon: under.lon, lat: under.lat });
    } else {
      setZoom(next);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    movedRef.current = false;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      lon: center.lon,
      lat: center.lat,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
    const origin = lonLatToWorldPx(d.lon, d.lat, zoom, TILE);
    const ll = worldPxToLonLat(origin.x - dx, origin.y - dy, zoom, TILE);
    setCenter({ lon: ll.lon, lat: ll.lat });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onClick = (e: React.MouseEvent) => {
    if (movedRef.current) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { lon, lat } = unproject(sx, sy);

    // Manual НСУ / цель / точки — выше GIS-инструментов (иначе Δ высоты и т.п. глотают клик).
    if (pickStationPosRef.current) {
      setGisTool("none");
      void placeOrMoveNsu(lat, lon)
        .then((st) => {
          setStations((prev) => {
            const i = prev.findIndex((x) => x.id === st.id);
            if (i < 0) return [...prev, st];
            const next = [...prev];
            next[i] = st;
            return next;
          });
          useGisStore.getState().setBottomPanelOpen(true);
          eventBus.emit(
            "info",
            "map",
            `НСУ установлена: ${st.latitude.toFixed(5)}, ${st.longitude.toFixed(5)}`,
          );
        })
        .catch((err) => {
          eventBus.emit(
            "error",
            "map",
            err instanceof Error ? err.message : "Не удалось поставить НСУ",
          );
        });
      return;
    }

    if (pickLookAtRef.current) {
      setGisTool("none");
      const hold =
        useTerrainMapStore.getState().controlMode === "hold";
      useStationPlannerStore
        .getState()
        .aimLookAt(lat, lon, { updateServos: !hold });
      eventBus.emit(
        "info",
        "map",
        hold
          ? "Цель B задана (hold — PAN/TILT без изменений)"
          : "Цель / направление задано",
      );
      return;
    }

    if (pickMarkerRef.current) {
      setGisTool("none");
      addMapMarker(lat, lon);
      eventBus.emit("info", "map", "Точка добавлена");
      return;
    }

    const tool = useGisStore.getState().tool;
    if (
      tool === "measureDistance" ||
      tool === "measureArea" ||
      tool === "measureAzimuth" ||
      tool === "measureDeltaH"
    ) {
      void pushMeasurePoint(lat, lon).then((r) => {
        if (r === "done") eventBus.emit("info", "map", "Измерение сохранено");
      });
      return;
    }
    if (tool === "routeEdit") {
      addRoutePoint(lat, lon);
      eventBus.emit("info", "map", "Точка маршрута");
      return;
    }
    if (tool === "obstaclePlace") {
      addObstacle({ lat, lng: lon, kind: "other" });
      eventBus.emit("info", "map", "Препятствие отмечено (ручное)");
      return;
    }
    if (tool === "profilePickA") {
      setProfileOverrideA({ lat, lng: lon });
      setGisTool("none");
      eventBus.emit("info", "map", "Профиль: точка A");
      return;
    }
    if (tool === "profilePickB") {
      setProfileOverrideB({ lat, lng: lon });
      setGisTool("none");
      eventBus.emit("info", "map", "Профиль: точка B");
      return;
    }

    if (measureModeRef.current) {
      if (!measureA) {
        setMeasureA({ lng: lon, lat });
        setDistanceM(0);
        return;
      }
      const meters = haversineM(
        { lat: measureA.lat, lng: measureA.lng },
        { lat, lng: lon },
      );
      setDistanceM(meters);
      setMeasureA(null);
      eventBus.emit(
        "info",
        "map",
        `Измерение: ${(meters / 1000).toFixed(2)} км`,
      );
    }
  };

  const addMarkerHere = () => {
    addMapMarker(center.lat, center.lon);
  };

  const zoomBy = (delta: number) => {
    setZoom((z) => Math.min(zMax, Math.max(MIN_Z, z + delta)));
  };

  const toolBtn = (on: boolean) =>
    on ? "ags-glass-btn ags-glass-btn--active" : "ags-glass-btn";

  const rangeRingPath = useMemo(() => {
    if (
      !layers.radius ||
      (!showRangeRing && !showRadiusPref) ||
      !active ||
      size.w <= 0
    )
      return null;
    const pts: string[] = [];
    for (let i = 0; i <= 72; i++) {
      const brg = (i / 72) * 360;
      const p = destinationPoint(
        active.latitude,
        active.longitude,
        brg,
        rangeKm * 1000,
      );
      const s = project(p.lng, p.lat);
      pts.push(`${i === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`);
    }
    return `${pts.join(" ")} Z`;
  }, [
    active,
    project,
    rangeKm,
    showRangeRing,
    showRadiusPref,
    layers.radius,
    size.w,
  ]);

  const horizonPath = useMemo(() => {
    if (!layers.radius || !horizon?.points.length || size.w <= 0) return null;
    const pts = horizon.points.map((p, i) => {
      const s = project(p.lng, p.lat);
      return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
    });
    return `${pts.join(" ")} Z`;
  }, [horizon, project, size.w]);

  const controlSectorPath = useMemo(() => {
    if (!layers.antennaSector || !plannerMode || !active || size.w <= 0)
      return null;
    return sectorPolygon(
      active.latitude,
      active.longitude,
      ((simAzimuthDeg % 360) + 360) % 360,
      controlPatchDeg / 2,
      rangeKm * 1000,
      (lon, lat) => project(lon, lat),
    );
  }, [
    active,
    controlPatchDeg,
    layers.antennaSector,
    plannerMode,
    project,
    rangeKm,
    simAzimuthDeg,
    size.w,
  ]);

  const videoSectorPath = useMemo(() => {
    if (!layers.antennaSector || !plannerMode || !active || size.w <= 0)
      return null;
    return sectorPolygon(
      active.latitude,
      active.longitude,
      ((simAzimuthDeg % 360) + 360) % 360,
      videoPatchDeg / 2,
      rangeKm * 1000,
      (lon, lat) => project(lon, lat),
    );
  }, [
    active,
    layers.antennaSector,
    plannerMode,
    project,
    rangeKm,
    simAzimuthDeg,
    size.w,
    videoPatchDeg,
  ]);

  const corridorStroke = (status: string) => {
    if (status === "clear") return "#5ad4a0";
    if (status === "tight") return "#f0c14a";
    if (status === "blocked") return "#e85d5d";
    return "#8899aa";
  };

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#0b1018]">
      <div
        ref={hostRef}
        className={
          pickStationPos ||
          pickLookAt ||
          pickMarker ||
          measureMode ||
          gisTool !== "none"
            ? "absolute inset-0 cursor-crosshair touch-none"
            : "absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        }
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onHostPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        role="presentation"
      >
        {showBaseTiles &&
          tiles.map((t) => (
            <SafeTile
              key={t.key}
              url={t.url}
              left={t.left}
              top={t.top}
              width={TILE}
              height={TILE}
              zIndex={0}
            />
          ))}

        {layers.relief &&
          demTiles.map((t) => (
            <DemOverlayTile
              key={`hs-${t.key}`}
              demUrl={t.url}
              left={t.left}
              top={t.top}
              size={t.size}
              kind="hillshade"
              opacity={layers.reliefOpacity}
              exaggeration={Math.min(3, verticalExaggeration)}
            />
          ))}
        {layers.demColormap &&
          demTiles.map((t) => (
            <DemOverlayTile
              key={`cm-${t.key}`}
              demUrl={t.url}
              left={t.left}
              top={t.top}
              size={t.size}
              kind="colormap"
              opacity={layers.colormapOpacity}
            />
          ))}
        {layers.contours &&
          demTiles.map((t) => (
            <DemOverlayTile
              key={`ct-${t.key}`}
              demUrl={t.url}
              left={t.left}
              top={t.top}
              size={t.size}
              kind="contour"
              opacity={0.85}
            />
          ))}

        {labelTiles.map((t) => (
          <SafeTile
            key={t.key}
            url={t.url}
            left={t.left}
            top={t.top}
            width={TILE}
            height={TILE}
            zIndex={2}
          />
        ))}

        {/* Range / patches / horizon / corridor / azimuth */}
        <svg className="pointer-events-none absolute inset-0 z-[3] h-full w-full">
          {rangeRingPath && (
            <path
              d={rangeRingPath}
              fill="rgba(61,139,253,0.06)"
              stroke="#3d8bfd"
              strokeWidth={1.5}
              strokeDasharray="8 6"
            />
          )}
          {controlSectorPath && (
            <path
              d={controlSectorPath}
              fill="rgba(240,193,74,0.12)"
              stroke="#f0c14a"
              strokeWidth={1.25}
              strokeOpacity={0.85}
            />
          )}
          {videoSectorPath && (
            <path
              d={videoSectorPath}
              fill="rgba(61,139,253,0.16)"
              stroke="#3d8bfd"
              strokeWidth={1.5}
            />
          )}
          {horizonPath && (
            <path
              d={horizonPath}
              fill="rgba(90,212,160,0.14)"
              stroke="#5ad4a0"
              strokeWidth={2}
            />
          )}
          {plannerMode &&
            active &&
            corridor?.samples.map((s, i, arr) => {
              if (i === 0) {
                const a = project(active.longitude, active.latitude);
                const b = project(s.lng, s.lat);
                return (
                  <line
                    key={`cor-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={corridorStroke(s.status)}
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                );
              }
              const prev = arr[i - 1]!;
              const a = project(prev.lng, prev.lat);
              const b = project(s.lng, s.lat);
              return (
                <line
                  key={`cor-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={corridorStroke(s.status)}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              );
            })}
          {displayStations.map((s) => {
            const useSim = plannerMode && s.id === activeStationId;
            const azDeg = useSim ? simAzimuthDeg : (s.azimuthDeg ?? null);
            if (azDeg == null && !useSim) return null;
            const dest =
              useSim && active
                ? destinationPoint(
                    s.latitude,
                    s.longitude,
                    azDeg ?? 0,
                    rangeKm * 1000,
                  )
                : (() => {
                    const d = destinationByAzimuth(
                      s.longitude,
                      s.latitude,
                      azDeg ?? 0,
                      0.02,
                    );
                    return { lat: d.lat, lng: d.lon };
                  })();
            const a = project(s.longitude, s.latitude);
            const b = project(dest.lng, dest.lat);
            return (
              <line
                key={`az-${s.id}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#ffffff"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeOpacity={0.9}
              />
            );
          })}
          {plannerMode && active && lookAt && layers.los && (
            <line
              x1={project(active.longitude, active.latitude).x}
              y1={project(active.longitude, active.latitude).y}
              x2={project(lookAt.lng, lookAt.lat).x}
              y2={project(lookAt.lng, lookAt.lat).y}
              stroke="#f0c14a"
              strokeWidth={2.25}
              strokeDasharray="7 5"
              strokeOpacity={0.95}
            />
          )}
          {/* Range ring distance ticks (like reference GCS) */}
          {plannerMode &&
            active &&
            layers.radius &&
            (showRangeRing || showRadiusPref) &&
            [0.25, 0.5, 0.75, 1].map((frac) => {
              const dM = rangeKm * 1000 * frac;
              const p = destinationPoint(
                active.latitude,
                active.longitude,
                ((simAzimuthDeg % 360) + 360) % 360,
                dM,
              );
              const s = project(p.lng, p.lat);
              return (
                <g key={`rr-${frac}`}>
                  <circle cx={s.x} cy={s.y} r={2.5} fill="#ffffffcc" />
                </g>
              );
            })}
        </svg>

        {/* Place labels — under station icons, never capture clicks */}
        {labelsOn &&
          !pickStationPos &&
          !pickLookAt &&
          !pickMarker &&
          placeLabels.map((p) => {
            const s = project(p.lng, p.lat);
            if (s.x < -40 || s.y < -20 || s.x > size.w + 40 || s.y > size.h + 20)
              return null;
            return (
              <div
                key={`${p.name}-${p.lat}`}
                className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90"
                style={{ left: s.x, top: s.y - 4 }}
              >
                {p.name}
              </div>
            );
          })}

        {/* Station markers — only icon/delete capture clicks; H-callout is visual */}
        {layers.station &&
          displayStations.map((s) => {
          const p = project(s.longitude, s.latitude);
          const isActive = s.id === activeStationId;
          const hLabel =
            s.antennaCenterAmslM != null
              ? `${s.antennaCenterAmslM.toFixed(0)} м`
              : s.terrainElevationM != null
                ? `${s.terrainElevationM.toFixed(0)} м`
                : null;
          return (
            <div
              key={s.id}
              className={
                isActive
                  ? "pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2"
                  : "pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 opacity-70"
              }
              style={{ left: p.x, top: p.y }}
            >
              <div className="relative flex items-start gap-1">
                <button
                  type="button"
                  title={
                    isActive
                      ? `${s.name} · активная НСУ`
                      : `${s.name} · выбрать`
                  }
                  className={
                    isActive
                      ? "pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-amber-500 shadow-[0_0_16px_rgba(240,193,74,0.55)]"
                      : "pointer-events-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/60 bg-amber-700/90 shadow"
                  }
                  onClick={(ev) => {
                    if (pickStationPos || pickLookAt || pickMarker) return;
                    ev.stopPropagation();
                    setActiveStationId(s.id);
                  }}
                  onPointerDown={(ev) => {
                    if (pickStationPos || pickLookAt || pickMarker) return;
                    ev.stopPropagation();
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 3v10M8 7l4-4 4 4M6 21h12M9 21v-4h6v4"
                      stroke="#111"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Удалить НСУ с карты"
                  className="pointer-events-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/70 text-[11px] leading-none text-red-300 hover:bg-red-700 hover:text-white"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void removeStation(s.id);
                  }}
                  onPointerDown={(ev) => ev.stopPropagation()}
                >
                  ×
                </button>
              </div>
              {isActive && (
                <div className="pointer-events-none mt-1 max-w-[9.5rem] translate-x-1 rounded border border-white/10 bg-black/70 px-1.5 py-1 text-left text-[9px] leading-tight text-ags-fg backdrop-blur-sm">
                  <div className="font-semibold text-amber-300">
                    НСУ · {s.name || "станция"}
                  </div>
                  <div className="font-mono text-[8px] text-ags-muted">
                    {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                  </div>
                  {hLabel && (
                    <div className="font-mono text-[8px] text-ags-fg">
                      H: {hLabel}
                      {plannerMode && rangeKm > 0
                        ? ` · R ${rangeKm.toFixed(0)} км`
                        : ""}
                    </div>
                  )}
                </div>
              )}
              {!isActive && (
                <div className="pointer-events-none mt-0.5 max-w-[4.5rem] truncate rounded bg-black/55 px-1 py-0.5 text-[8px] text-white/85">
                  {s.name}
                </div>
              )}
            </div>
          );
        })}

        {layers.userPoints &&
          mapMarkers.map((m) => {
          const p = project(m.lng, m.lat);
          return (
            <button
              key={m.id}
              type="button"
              title={`${m.label} · клик — удалить`}
              className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: p.x, top: p.y }}
              onClick={(ev) => {
                if (pickStationPos || pickLookAt || pickMarker) return;
                ev.stopPropagation();
                removeMapMarker(m.id);
              }}
              onPointerDown={(ev) => {
                if (pickStationPos || pickLookAt || pickMarker) return;
                ev.stopPropagation();
              }}
            >
              <span className="h-3 w-3 rounded-full border-2 border-white bg-sky-400 shadow" />
              <span className="mt-0.5 max-w-[5rem] truncate rounded bg-black/60 px-1 text-[8px] text-white">
                {m.label}
              </span>
            </button>
          );
        })}

        {layers.drone && plannerMode && lookAt && (
          <div
            className="pointer-events-none absolute z-[3] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{
              left: project(lookAt.lng, lookAt.lat).x,
              top: project(lookAt.lng, lookAt.lat).y,
            }}
            title="Цель B"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-ags-accent shadow-[0_0_14px_rgba(61,139,253,0.5)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 4l3 6h5l-4 3.5 1.5 6.5L12 16l-5.5 4 1.5-6.5L4 10h5l3-6z"
                  fill="#fff"
                />
              </svg>
            </span>
            <span className="ags-glass-bar px-1.5 py-0.5 text-[9px] font-semibold text-sky-200">
              Цель B
            </span>
          </div>
        )}

        {plannerMode && active && lookAt && layers.los && (
          <div
            className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2"
            style={{
              left:
                (project(active.longitude, active.latitude).x +
                  project(lookAt.lng, lookAt.lat).x) /
                2,
              top:
                (project(active.longitude, active.latitude).y +
                  project(lookAt.lng, lookAt.lat).y) /
                2,
            }}
          >
            <span className="ags-glass-bar px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-200">
              {(
                haversineM(
                  { lat: active.latitude, lng: active.longitude },
                  { lat: lookAt.lat, lng: lookAt.lng },
                ) / 1000
              ).toFixed(2)}{" "}
              км
            </span>
          </div>
        )}

        {plannerMode &&
          active &&
          layers.radius &&
          (showRangeRing || showRadiusPref) &&
          [0.5, 1].map((frac) => {
            const dM = rangeKm * 1000 * frac;
            const p = destinationPoint(
              active.latitude,
              active.longitude,
              ((simAzimuthDeg % 360) + 360) % 360,
              dM,
            );
            const s = project(p.lng, p.lat);
            return (
              <div
                key={`rr-lbl-${frac}`}
                className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2 rounded bg-black/50 px-1 py-0.5 font-mono text-[9px] text-white/80"
                style={{ left: s.x + 12, top: s.y - 6 }}
              >
                {(dM / 1000).toFixed(1)} км
              </div>
            );
          })}

        {/* Azimuth compass HUD */}
        {plannerMode && (
          <div className="ags-glass-panel pointer-events-none absolute right-3 top-14 z-10 flex h-[5.25rem] w-[5.25rem] flex-col items-center justify-center gap-0.5">
            <div className="relative h-14 w-14 rounded-full border border-white/25 bg-black/20">
              <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[9px] font-bold text-ags-accent">
                N
              </span>
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  transform: `rotate(${((simAzimuthDeg % 360) + 360) % 360}deg)`,
                }}
              >
                <div className="mb-5 h-5 w-0.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(240,193,74,0.8)]" />
              </div>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold text-ags-fg">
                {(((simAzimuthDeg % 360) + 360) % 360).toFixed(0)}°
              </span>
            </div>
            <span className="text-[8px] uppercase tracking-wide text-ags-muted">
              Азимут
            </span>
          </div>
        )}

        {layers.route &&
          routes.map((r) => {
            if (r.points.length === 0) return null;
            const pts = r.points.map((p) => project(p.lng, p.lat));
            const d = pts
              .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
              .join(" ");
            return (
              <svg
                key={r.id}
                className="pointer-events-none absolute inset-0 z-[4] h-full w-full"
              >
                <path
                  d={d}
                  fill="none"
                  stroke="#7dd3fc"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
                {pts.map((p, i) => (
                  <circle
                    key={r.points[i]!.id}
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill="#0ea5e9"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ))}
              </svg>
            );
          })}

        {layers.obstacles &&
          obstacles.map((o) => {
            const p = project(o.lng, o.lat);
            return (
              <div
                key={o.id}
                className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2 rounded bg-red-700/90 px-1 text-[8px] text-white"
                style={{ left: p.x, top: p.y }}
                title={`${o.name} · источник: ${o.source}`}
              >
                ▲
              </div>
            );
          })}

        {layers.measurements && measureDraft.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full">
            {measureDraft.map((p, i) => {
              const s = project(p.lng, p.lat);
              return (
                <circle
                  key={`md-${i}`}
                  cx={s.x}
                  cy={s.y}
                  r={4}
                  fill="#fbbf24"
                  stroke="#fff"
                />
              );
            })}
            {measureDraft.length >= 2 && (
              <path
                d={measureDraft
                  .map((p, i) => {
                    const s = project(p.lng, p.lat);
                    return `${i === 0 ? "M" : "L"}${s.x},${s.y}`;
                  })
                  .join(" ")}
                fill="rgba(251,191,36,0.15)"
                stroke="#fbbf24"
                strokeWidth={1.5}
              />
            )}
          </svg>
        )}

        {(() => {
          const d = droneEff();
          // lookAt already drawn as «Цель B» + amber LOS — skip duplicate.
          if (
            !layers.drone ||
            d.source === "none" ||
            d.source === "lookAt" ||
            size.w <= 0
          )
            return null;
          const p = project(d.lng, d.lat);
          const a = active
            ? project(active.longitude, active.latitude)
            : null;
          return (
            <>
              {a && (
                <svg className="pointer-events-none absolute inset-0 z-[3] h-full w-full">
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={p.x}
                    y2={p.y}
                    stroke="#cfe4ff"
                    strokeWidth={2}
                    strokeDasharray="4 5"
                    strokeOpacity={0.9}
                  />
                </svg>
              )}
              <div
                className="absolute z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ags-warning px-1.5 py-0.5 text-[9px] font-bold text-black shadow"
                style={{ left: p.x, top: p.y }}
                title={
                  d.source === "live"
                    ? "Дрон (телеметрия)"
                    : d.source === "demo"
                      ? "DEMO дрон"
                      : "Цель"
                }
              >
                {d.source === "live"
                  ? "Дрон"
                  : d.source === "demo"
                    ? "DEMO"
                    : "Цель"}
                {d.amslM != null ? ` · ${d.amslM.toFixed(0)}м` : ""}
              </div>
            </>
          );
        })()}

        {active && (showRangeRing || showRadiusPref) && (
          <div
            className="pointer-events-none absolute z-[4] -translate-x-1/2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-ags-accent"
            style={{
              left: project(active.longitude, active.latitude).x,
              top: project(active.longitude, active.latitude).y + 18,
            }}
          >
            R = {rangeKm.toFixed(1)} км
          </div>
        )}

      </div>

      {!ready && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#0b1018] text-sm text-ags-muted">
          Включение карты…
        </div>
      )}

      {ready && tileStatus === "fail" && tileMode === "offline" && (
        <div className="absolute bottom-14 left-1/2 z-[5] -translate-x-1/2 rounded bg-ags-danger/90 px-3 py-1.5 text-xs text-white">
          Офлайн-тайлы не найдены в сборке
        </div>
      )}

      <div className="ags-glass-bar pointer-events-auto absolute left-3 top-3 z-10 flex max-w-[min(92%,44rem)] flex-wrap items-center gap-1.5 p-1.5 text-[11px]">
        <select
          className="ags-select !rounded-md !py-1 !text-[11px]"
          value={tileMode}
          onChange={(e) => setTileMode(e.target.value as TileMode)}
          aria-label="Источник тайлов"
        >
          <option value="streets">Улицы (офлайн/CARTO)</option>
          <option value="hybrid">Гибрид: спутник + улицы</option>
          <option value="offline">Спутник офлайн</option>
          <option value="carto">Улицы онлайн (CARTO)</option>
          <option value="osm">OSM онлайн</option>
          <option value="local">Локальные XYZ</option>
        </select>
        {tileMode === "local" && (
          <input
            className="ags-select min-w-[10rem] flex-1 !rounded-md !py-1"
            placeholder="/tiles/{z}/{x}/{y}.jpg"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
          />
        )}
        <button type="button" className={toolBtn(false)} onClick={() => zoomBy(1)}>
          +
        </button>
        <button type="button" className={toolBtn(false)} onClick={() => zoomBy(-1)}>
          −
        </button>
        <button
          type="button"
          className={toolBtn(false)}
          onClick={() => {
            setCenter({
              lon: DEFAULT_MAP_CENTER[0],
              lat: DEFAULT_MAP_CENTER[1],
            });
            setZoom(DEFAULT_MAP_ZOOM);
          }}
        >
          Смоленск
        </button>
        {plannerMode && (
          <>
            <button
              type="button"
              className={toolBtn(pickStationPos)}
              title="Клик по карте — поставить / сдвинуть НСУ"
              onClick={() => {
                const next = !pickStationPos;
                setPickStationPos(next);
                setMeasureMode(false);
                if (next) {
                  setGisTool("none");
                  useGisStore.getState().setBottomPanelOpen(true);
                }
              }}
            >
              {pickStationPos ? "Клик: НСУ…" : "НСУ"}
            </button>
            <button
              type="button"
              className={toolBtn(pickLookAt)}
              title="Клик по карте — цель / направление B"
              onClick={() => {
                const next = !pickLookAt;
                setPickLookAt(next);
                setMeasureMode(false);
                if (next) {
                  setGisTool("none");
                  useGisStore.getState().setBottomPanelOpen(true);
                }
              }}
            >
              {pickLookAt ? "Клик: цель…" : "Цель B"}
            </button>
            <button
              type="button"
              className={toolBtn(pickMarker)}
              title="Клик по карте — свободная точка"
              onClick={() => {
                const next = !pickMarker;
                setPickMarker(next);
                setMeasureMode(false);
                if (next) setGisTool("none");
              }}
            >
              {pickMarker ? "Клик: точка…" : "Точка"}
            </button>
          </>
        )}
        <button type="button" className={toolBtn(false)} onClick={addMarkerHere}>
          Метка@центр
        </button>
        <button
          type="button"
          className={toolBtn(measureMode)}
          onClick={() => {
            setMeasureMode((v) => !v);
            setMeasureA(null);
            if (!measureMode) {
              setPickStationPos(false);
              setPickLookAt(false);
              setPickMarker(false);
            }
          }}
        >
          {measureMode ? "Стоп линейка" : "Линейка"}
        </button>
        <button
          type="button"
          className={toolBtn(layers.relief)}
          onClick={() => {
            useGisStore.getState().setLayer("relief", !layers.relief);
            eventBus.emit(
              "info",
              "map",
              layers.relief
                ? "Рельеф (hillshade) выкл"
                : "Рельеф: Terrarium hillshade поверх спутника",
            );
          }}
        >
          Рельеф
        </button>
        <button
          type="button"
          className={toolBtn(layers.demColormap)}
          onClick={() =>
            useGisStore.getState().setLayer("demColormap", !layers.demColormap)
          }
        >
          Высоты
        </button>
        <button
          type="button"
          className={toolBtn(labelsOn)}
          onClick={() => setLabelsOn((v) => !v)}
        >
          Подписи
        </button>
        {!plannerMode && (
          <>
            <button
              type="button"
              className={toolBtn(showRangeRing)}
              onClick={() => setShowRangeRing(!showRangeRing)}
            >
              Радиус
            </button>
            <label className="flex items-center gap-1 text-ags-muted">
              км
              <input
                type="number"
                className="ags-select w-14 !rounded-md !py-0.5 font-mono"
                min={1}
                max={300}
                step={1}
                value={rangeKm}
                onChange={(e) => setRangeKm(Number(e.target.value))}
                aria-label="Радиус действия км"
              />
            </label>
            <button
              type="button"
              className={toolBtn(showRadioHorizon)}
              disabled={!active}
              onClick={() => setShowRadioHorizon(!showRadioHorizon)}
            >
              Радиогоризонт
            </button>
          </>
        )}
        {distanceM != null && (
          <span className="px-1.5 font-mono text-ags-fg">
            {(distanceM / 1000).toFixed(3)} км
          </span>
        )}
        <span className="px-1 text-ags-dim">
          z{zoom}
          {tileStatus === "ok" ? " · OK" : ""}
          {tileMode === "streets" || tileMode === "carto" || tileMode === "hybrid"
            ? streetsOnlineFallback
              ? " · © OSM/CARTO онлайн"
              : " · © OSM/CARTO"
            : ""}
        </span>
      </div>

      {(plannerMode || showRangeRing || showRadioHorizon) && (
        <div className="ags-glass-bar pointer-events-none absolute bottom-3 left-3 z-10 max-w-lg px-2 py-1.5 text-[10px] leading-snug text-ags-muted">
          {plannerMode && active && (
            <div>
              Жёлтый сектор — патч управления ({controlPatchDeg}°) · синий —
              видео ({videoPatchDeg}°) · белый пунктир — направление.
              {corridor
                ? ` Коридор высот: просвет до ${(corridor.clearToM / 1000).toFixed(1)} км (мачта ${active.mastHeightM ?? 15} м).`
                : ""}
            </div>
          )}
          {showRangeRing && !plannerMode && (
            <div>Синий пунктир — радиус ({rangeKm} км).</div>
          )}
          {showRadioHorizon && (
            <div>
              Зелёная зона — геометрический радиогоризонт (DEM)
              {horizon
                ? ` · ≤ ${(horizon.geometricMaxM / 1000).toFixed(1)} км`
                : ""}
              .
            </div>
          )}
          {!active && (
            <div className="text-ags-muted">
              Нажмите <span className="text-ags-accent">НСУ</span> и кликните
              карту — станция создаётся без выбора из дерева.
            </div>
          )}
          {(pickStationPos || pickLookAt || pickMarker) && (
            <div className="text-ags-accent">
              {pickStationPos
                ? "Клик по карте — поставить НСУ."
                : pickLookAt
                  ? "Клик по карте — цель / направление B."
                  : "Клик по карте — свободная точка."}
            </div>
          )}
        </div>
      )}

      {canManage && active && (
        <button
          type="button"
          className="ags-glass-btn pointer-events-auto absolute bottom-3 right-3 z-10"
          onClick={() => {
            void upsertStation({
              ...active,
              latitude: center.lat,
              longitude: center.lon,
            }).then((saved) => {
              setStations((prev) =>
                prev.map((x) => (x.id === saved.id ? saved : x)),
              );
              void useStationPlannerStore.getState().refresh();
              eventBus.emit(
                "info",
                "map",
                `Станция ${saved.name}: координаты = центр карты`,
              );
            });
          }}
        >
          Станция → центр
        </button>
      )}
    </div>
  );
}
