import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eventBus } from "@/services/events/eventBus";
import {
  listStations,
  upsertStation,
  type Station,
} from "@/services/stations";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useAuthStore } from "@/stores/authStore";
import { bearingDeg, haversineM } from "@/utils/geo";
import {
  absoluteAssetUrl,
  BUNDLED_DEM_MAX_ZOOM,
  BUNDLED_DEM_MIN_ZOOM,
  BUNDLED_DEM_TILES,
  BUNDLED_LABEL_TILES,
  BUNDLED_OFFLINE_TILES,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "./mapStyles";
import { HillshadeTile } from "./HillshadeTile";
import { placesVisibleAtZoom } from "./places";
import { SafeTile } from "./SafeTile";
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
import { getTerrainAdapter } from "@/services/terrain/terrainEngine";
import { destinationPoint } from "@/utils/geo";

interface UserMarker {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

type TileMode = "osm" | "offline" | "local";

const TILE = 256;
const MIN_Z = 2;
const MAX_Z_OFFLINE = 12;
const MAX_Z_OSM = 18;

function templateFor(mode: TileMode, localUrl: string): string {
  if (mode === "osm") {
    return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  if (mode === "local") {
    return absoluteAssetUrl(localUrl || BUNDLED_OFFLINE_TILES);
  }
  return absoluteAssetUrl(BUNDLED_OFFLINE_TILES);
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

  const [markers, setMarkers] = useState<UserMarker[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const canManage = useAuthStore((s) => s.can("manageDevices"));
  const setActiveStationId = useStationPlannerStore((s) => s.setActiveStationId);
  const activeComplexId = useStationPlannerStore((s) => s.activeComplexId);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const simAzimuthDeg = useStationPlannerStore((s) => s.simAzimuthDeg);
  const lookAt = useStationPlannerStore((s) => s.lookAt);
  const pickLookAt = useStationPlannerStore((s) => s.pickLookAt);
  const setLookAt = useStationPlannerStore((s) => s.setLookAt);
  const setPickLookAt = useStationPlannerStore((s) => s.setPickLookAt);
  const setSimAzimuthDeg = useStationPlannerStore((s) => s.setSimAzimuthDeg);
  const plannerStations = useStationPlannerStore((s) => s.stations);
  const rangeKm = useStationPlannerStore((s) => s.rangeKm);
  const showRangeRing = useStationPlannerStore((s) => s.showRangeRing);
  const showRadioHorizon = useStationPlannerStore((s) => s.showRadioHorizon);
  const setRangeKm = useStationPlannerStore((s) => s.setRangeKm);
  const setShowRangeRing = useStationPlannerStore((s) => s.setShowRangeRing);
  const setShowRadioHorizon = useStationPlannerStore(
    (s) => s.setShowRadioHorizon,
  );

  const [measureMode, setMeasureMode] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);
  const [horizon, setHorizon] = useState<HorizonResult | null>(null);
  const [measureA, setMeasureA] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>("offline");
  const [localUrl, setLocalUrl] = useState(BUNDLED_OFFLINE_TILES);
  /** Relief hillshade from Terrarium DEM — on by default. */
  const [reliefOn, setReliefOn] = useState(true);

  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;
  const pickLookAtRef = useRef(pickLookAt);
  pickLookAtRef.current = pickLookAt;

  const zMax = tileMode === "osm" ? MAX_Z_OSM : MAX_Z_OFFLINE;
  const tileTpl = templateFor(tileMode, localUrl);

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

  // Probe offline Smolensk tile once ready.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const probe = absoluteAssetUrl("/tiles/10/603/324.jpg");
        const res = await fetch(probe);
        if (cancelled) return;
        setTileStatus(res.ok ? "ok" : "fail");
        eventBus.emit(
          res.ok ? "info" : "warning",
          "map",
          res.ok
            ? "Карта: спутник Esri Imagery · Смоленск OK"
            : `Офлайн-тайл недоступен (${res.status})`,
        );
      } catch (e) {
        if (cancelled) return;
        setTileStatus("fail");
        eventBus.emit(
          "warning",
          "map",
          e instanceof Error ? e.message : "Тайл-проверка не удалась",
        );
      }
    })();
    eventBus.emit("info", "map", "Карта: автозапуск · спутник + рельеф");
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    void listStations({ complexId: activeComplexId })
      .then(setStations)
      .catch(() => setStations([]));
  }, [activeComplexId]);

  const displayStations = plannerMode ? plannerStations : stations;
  const active = displayStations.find((s) => s.id === activeStationId);

  // Geometric radio-horizon lobe (DEM) — capped by operator range.
  useEffect(() => {
    if (!showRadioHorizon || !active) {
      setHorizon(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const mast = active.mastHeightM ?? 15;
      let antennaAmsl = active.antennaCenterAmslM ?? null;
      if (antennaAmsl == null) {
        const s = await getTerrainAdapter().sample(
          active.latitude,
          active.longitude,
        );
        if (s.elevationM != null) antennaAmsl = s.elevationM + mast;
      }
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
    active?.id,
    active?.latitude,
    active?.longitude,
    active?.mastHeightM,
    active?.antennaCenterAmslM,
    rangeKm,
    showRadioHorizon,
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
    () =>
      labelsOn && tileMode === "offline"
        ? buildTileGrid(absoluteAssetUrl(BUNDLED_LABEL_TILES))
        : [],
    [buildTileGrid, labelsOn, tileMode],
  );
  const placeLabels = useMemo(() => placesVisibleAtZoom(zoom), [zoom]);

  /** DEM tiles for hillshade (clamp to bundled Terrarium zooms). */
  const demTiles = useMemo(() => {
    if (!reliefOn || size.w <= 0 || size.h <= 0) return [];
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
  }, [center.lat, center.lon, reliefOn, size.h, size.w, zoom]);

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

    if (pickLookAtRef.current) {
      const state = useStationPlannerStore.getState();
      const st = state.stations.find((s) => s.id === state.activeStationId);
      setLookAt({ lat, lng: lon });
      if (st) {
        const brg = bearingDeg(
          { lat: st.latitude, lng: st.longitude },
          { lat, lng: lon },
        );
        let signed = brg > 180 ? brg - 360 : brg;
        const { azMin, azMax } = state.panTiltRanges;
        signed = Math.min(azMax, Math.max(azMin, signed));
        setSimAzimuthDeg(signed);
      }
      eventBus.emit("info", "map", "Точка наблюдения B задана");
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
    setMarkers((prev) => [
      ...prev,
      {
        id: `m_${Date.now().toString(36)}`,
        lng: center.lon,
        lat: center.lat,
        label: `Метка ${prev.length + 1}`,
      },
    ]);
  };

  const zoomBy = (delta: number) => {
    setZoom((z) => Math.min(zMax, Math.max(MIN_Z, z + delta)));
  };

  const toolBtn = (on: boolean) =>
    on ? "ags-glass-btn ags-glass-btn--active" : "ags-glass-btn";

  const rangeRingPath = useMemo(() => {
    if (!showRangeRing || !active || size.w <= 0) return null;
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
    size.w,
  ]);

  const horizonPath = useMemo(() => {
    if (!horizon?.points.length || size.w <= 0) return null;
    const pts = horizon.points.map((p, i) => {
      const s = project(p.lng, p.lat);
      return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
    });
    return `${pts.join(" ")} Z`;
  }, [horizon, project, size.w]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#0b1018]">
      <div
        ref={hostRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        role="presentation"
      >
        {tiles.map((t) => (
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

        {demTiles.map((t) => (
          <HillshadeTile
            key={t.key}
            demUrl={t.url}
            left={t.left}
            top={t.top}
            size={t.size}
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

        {/* Range / radio-horizon / azimuth */}
        <svg className="pointer-events-none absolute inset-0 z-[3] h-full w-full">
          {rangeRingPath && (
            <path
              d={rangeRingPath}
              fill="rgba(61,139,253,0.08)"
              stroke="#3d8bfd"
              strokeWidth={1.5}
              strokeDasharray="8 6"
            />
          )}
          {horizonPath && (
            <path
              d={horizonPath}
              fill="rgba(90,212,160,0.18)"
              stroke="#5ad4a0"
              strokeWidth={2}
            />
          )}
          {displayStations.map((s) => {
            const useSim = plannerMode && s.id === activeStationId;
            const azDeg = useSim ? simAzimuthDeg : (s.azimuthDeg ?? null);
            if (azDeg == null && !useSim) return null;
            const dest = destinationByAzimuth(
              s.longitude,
              s.latitude,
              azDeg ?? 0,
              0.02,
            );
            const a = project(s.longitude, s.latitude);
            const b = project(dest.lon, dest.lat);
            return (
              <line
                key={`az-${s.id}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#3d8bfd"
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
            );
          })}
          {plannerMode && active && lookAt && (
            <line
              x1={project(active.longitude, active.latitude).x}
              y1={project(active.longitude, active.latitude).y}
              x2={project(lookAt.lng, lookAt.lat).x}
              y2={project(lookAt.lng, lookAt.lat).y}
              stroke="#f0c14a"
              strokeWidth={2}
            />
          )}
        </svg>

        {/* Smart place labels */}
        {labelsOn &&
          placeLabels.map((p) => {
            const s = project(p.lng, p.lat);
            if (s.x < -40 || s.y < -20 || s.x > size.w + 40 || s.y > size.h + 20)
              return null;
            return (
              <div
                key={`${p.name}-${p.lat}`}
                className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
                style={{ left: s.x, top: s.y - 4 }}
              >
                {p.name}
              </div>
            );
          })}

        {/* Station markers */}
        {displayStations.map((s) => {
          const p = project(s.longitude, s.latitude);
          const isActive = s.id === activeStationId;
          return (
            <button
              key={s.id}
              type="button"
              title={s.name}
              className={
                isActive
                  ? "absolute z-[2] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-ags-accent bg-ags-warning shadow"
                  : "absolute z-[2] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-ags-warning bg-ags-elevated shadow"
              }
              style={{ left: p.x, top: p.y }}
              onClick={(ev) => {
                ev.stopPropagation();
                setActiveStationId(s.id);
              }}
              onPointerDown={(ev) => ev.stopPropagation()}
            />
          );
        })}

        {markers.map((m) => {
          const p = project(m.lng, m.lat);
          return (
            <div
              key={m.id}
              title={m.label}
              className="absolute z-[2] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ags-accent shadow"
              style={{ left: p.x, top: p.y }}
            />
          );
        })}

        {plannerMode && lookAt && (
          <div
            className="absolute z-[2] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-ags-accent text-[8px] font-bold text-white shadow"
            style={{
              left: project(lookAt.lng, lookAt.lat).x,
              top: project(lookAt.lng, lookAt.lat).y,
            }}
          >
            B
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
          <option value="offline">Офлайн</option>
          <option value="local">Локальные XYZ</option>
          <option value="osm">OSM онлайн</option>
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
        <button type="button" className={toolBtn(false)} onClick={addMarkerHere}>
          Метка
        </button>
        <button
          type="button"
          className={toolBtn(measureMode)}
          onClick={() => {
            setMeasureMode((v) => !v);
            setMeasureA(null);
          }}
        >
          {measureMode ? "Стоп линейка" : "Линейка"}
        </button>
        {plannerMode && (
          <button
            type="button"
            className={toolBtn(pickLookAt)}
            onClick={() => setPickLookAt(!pickLookAt)}
          >
            {pickLookAt ? "Клик: B…" : "Точка B"}
          </button>
        )}
        <button
          type="button"
          className={toolBtn(reliefOn)}
          onClick={() => {
            setReliefOn((v) => !v);
            eventBus.emit(
              "info",
              "map",
              reliefOn
                ? "Рельеф (hillshade) выкл"
                : "Рельеф: Terrarium hillshade поверх спутника",
            );
          }}
        >
          Рельеф
        </button>
        <button
          type="button"
          className={toolBtn(labelsOn)}
          onClick={() => setLabelsOn((v) => !v)}
        >
          Подписи
        </button>
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
          title={
            active
              ? "Геометрический радиогоризонт по DEM (k=4/3)"
              : "Выберите станцию"
          }
          onClick={() => {
            setShowRadioHorizon(!showRadioHorizon);
            eventBus.emit(
              "info",
              "map",
              showRadioHorizon
                ? "Радиогоризонт выкл"
                : "Радиогоризонт: геометрия DEM · не измеренный RF",
            );
          }}
        >
          Радиогоризонт
        </button>
        {distanceM != null && (
          <span className="px-1.5 font-mono text-ags-fg">
            {(distanceM / 1000).toFixed(3)} км
          </span>
        )}
        <span className="px-1 text-ags-dim">
          z{zoom}
          {tileStatus === "ok" ? " · OK" : ""}
        </span>
      </div>

      {(showRangeRing || showRadioHorizon) && (
        <div className="ags-glass-bar pointer-events-none absolute bottom-3 left-3 z-10 max-w-md px-2 py-1.5 text-[10px] leading-snug text-ags-muted">
          {showRangeRing && (
            <div>
              Синий пунктир — заданный радиус действия ({rangeKm} км).
            </div>
          )}
          {showRadioHorizon && (
            <div>
              Зелёная зона — геометрический радиогоризонт (k=4/3, DEM)
              {horizon
                ? ` · горизонт ≤ ${(horizon.geometricMaxM / 1000).toFixed(1)} км`
                : ""}
              . Не измеренный RF и не прогноз канала.
            </div>
          )}
          {!active && (
            <div className="text-ags-warning">
              Выберите станцию (точка А), чтобы считать радиус / горизонт.
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
