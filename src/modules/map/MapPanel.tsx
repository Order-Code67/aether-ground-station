import { useEffect, useRef, useState } from "react";
import {
  Map,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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
  BUNDLED_DEM_MAX_ZOOM,
  BUNDLED_DEM_TILES,
  BUNDLED_OFFLINE_TILES,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  OSM_STYLE,
  offlineStyle,
} from "./mapStyles";

interface UserMarker {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

type TileMode = "osm" | "offline" | "local";

export function MapPanel({ plannerMode = false }: { plannerMode?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const measureRef = useRef<{
    a: { lng: number; lat: number };
    b?: { lng: number; lat: number };
  } | null>(null);
  const lookAtMarkerRef = useRef<Marker | null>(null);

  const [terrain, setTerrain] = useState(false);
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

  const [measureMode, setMeasureMode] = useState(false);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>("offline");
  const [localUrl, setLocalUrl] = useState(BUNDLED_OFFLINE_TILES);
  const stationMarkersRef = useRef<Marker[]>([]);

  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;
  const pickLookAtRef = useRef(pickLookAt);
  pickLookAtRef.current = pickLookAt;

  const styleFor = (mode: TileMode, url: string) => {
    if (mode === "osm") return OSM_STYLE;
    if (mode === "local") return offlineStyle(url || undefined);
    return offlineStyle();
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = new Map({
        container: containerRef.current,
        style: styleFor(tileMode, localUrl),
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        maxPitch: 85,
        pitchWithRotate: true,
      });
      map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new ScaleControl({ unit: "metric" }));
      map.on("error", (e) => {
        const msg =
          e.error instanceof Error
            ? e.error.message
            : "Ошибка слоя карты (тайлы / worker)";
        eventBus.emit("warning", "map", msg);
      });
      map.on("click", (e: MapMouseEvent) => {
        if (pickLookAtRef.current) {
          const state = useStationPlannerStore.getState();
          const st = state.stations.find((s) => s.id === state.activeStationId);
          setLookAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          if (st) {
            const brg = bearingDeg(
              { lat: st.latitude, lng: st.longitude },
              { lat: e.lngLat.lat, lng: e.lngLat.lng },
            );
            let signed = brg > 180 ? brg - 360 : brg;
            const { azMin, azMax } = state.panTiltRanges;
            signed = Math.min(azMax, Math.max(azMin, signed));
            setSimAzimuthDeg(signed);
          }
          eventBus.emit("info", "map", "Точка наблюдения B задана");
          return;
        }
        if (!measureModeRef.current) return;
        const point = e.lngLat;
        if (!measureRef.current) {
          measureRef.current = { a: { lng: point.lng, lat: point.lat } };
          setDistanceM(0);
          return;
        }
        const a = measureRef.current.a;
        const b = { lng: point.lng, lat: point.lat };
        measureRef.current = { a, b };
        const meters = haversineM(
          { lat: a.lat, lng: a.lng },
          { lat: b.lat, lng: b.lng },
        );
        setDistanceM(meters);
        eventBus.emit(
          "info",
          "map",
          `Измерение: ${(meters / 1000).toFixed(2)} км`,
        );
      });
      mapRef.current = map;
      eventBus.emit(
        "info",
        "map",
        tileMode === "offline"
          ? "Карта: офлайн-тайлы (без интернета)"
          : "Карта инициализирована",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка инициализации карты");
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      lookAtMarkerRef.current?.remove();
      lookAtMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(styleFor(tileMode, localUrl));
    } catch (e) {
      eventBus.emit(
        "error",
        "map",
        e instanceof Error ? e.message : "Не удалось сменить стиль",
      );
    }
  }, [tileMode, localUrl]);

  /** Offline Terrarium DEM → MapLibre 3D pitch + hillshade. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      try {
        if (terrain) {
          if (!map.getSource("dem")) {
            map.addSource("dem", {
              type: "raster-dem",
              tiles: [BUNDLED_DEM_TILES],
              tileSize: 256,
              encoding: "terrarium",
              maxzoom: BUNDLED_DEM_MAX_ZOOM,
              attribution: "Mapzen Terrarium · Смоленск / ЦФО",
            });
          }
          if (!map.getLayer("hillshade")) {
            map.addLayer({
              id: "hillshade",
              type: "hillshade",
              source: "dem",
              paint: {
                "hillshade-exaggeration": 0.45,
                "hillshade-shadow-color": "#060a10",
                "hillshade-highlight-color": "#c8d2de",
                "hillshade-illumination-direction": 315,
              },
            });
          }
          map.setTerrain({ source: "dem", exaggeration: 1.35 });
          map.easeTo({ pitch: 58, bearing: map.getBearing(), duration: 700 });
        } else {
          map.setTerrain(null);
          if (map.getLayer("hillshade")) map.removeLayer("hillshade");
          if (map.getSource("dem")) map.removeSource("dem");
          map.easeTo({ pitch: 0, duration: 450 });
        }
      } catch (e) {
        eventBus.emit(
          "warning",
          "map",
          e instanceof Error
            ? e.message
            : "Не удалось включить 3D рельеф (нет DEM тайлов?)",
        );
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [terrain, tileMode, localUrl]);

  useEffect(() => {
    void listStations({ complexId: activeComplexId })
      .then(setStations)
      .catch(() => setStations([]));
  }, [activeComplexId]);

  // Prefer planner store stations when in planner (fresher selection sync).
  const displayStations = plannerMode ? plannerStations : stations;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = markers.map((m) => {
      const el = document.createElement("div");
      el.className =
        "h-3 w-3 rounded-full border-2 border-white bg-ags-accent shadow";
      el.title = m.label;
      return new Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(new Popup().setText(m.label))
        .addTo(map);
    });
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    stationMarkersRef.current.forEach((m) => m.remove());
    stationMarkersRef.current = displayStations.map((s) => {
      const el = document.createElement("div");
      const active = s.id === activeStationId;
      el.className = active
        ? "h-4 w-4 rotate-45 border-2 border-ags-accent bg-ags-warning shadow"
        : "h-3.5 w-3.5 rotate-45 border-2 border-ags-warning bg-ags-elevated shadow";
      const azForMarker =
        plannerMode && s.id === activeStationId
          ? simAzimuthDeg
          : (s.azimuthDeg ?? 0);
      el.title = `${s.name} az=${azForMarker}`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setActiveStationId(s.id);
      });
      const popup = new Popup().setHTML(
        `<strong>${s.name}</strong><br/>AMSL ant: ${
          s.antennaCenterAmslM == null
            ? "N/A"
            : s.antennaCenterAmslM.toFixed(1) + " m"
        }<br/>Az ${azForMarker.toFixed(1)}°`,
      );
      const marker = new Marker({ element: el, draggable: canManage })
        .setLngLat([s.longitude, s.latitude])
        .setPopup(popup)
        .setRotation(azForMarker)
        .addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        void upsertStation({
          ...s,
          latitude: ll.lat,
          longitude: ll.lng,
        }).then((saved) => {
          setStations((prev) =>
            prev.map((x) => (x.id === saved.id ? saved : x)),
          );
          void useStationPlannerStore.getState().refresh();
          eventBus.emit(
            "info",
            "map",
            `Станция ${saved.name}: координаты сохранены`,
          );
        });
      });
      return marker;
    });

    const srcId = "ags-station-azimuth";
    const layerId = "ags-station-azimuth-line";
    const features = displayStations.map((s) => {
      const useSim = plannerMode && s.id === activeStationId;
      const azDeg = useSim ? simAzimuthDeg : (s.azimuthDeg ?? null);
      if (azDeg == null && !useSim) return null;
      const az = ((azDeg ?? 0) * Math.PI) / 180;
      const lenDeg = 0.02;
      const dest = {
        lng: s.longitude + Math.sin(az) * lenDeg,
        lat: s.latitude + Math.cos(az) * lenDeg,
      };
      return {
        type: "Feature" as const,
        properties: { id: s.id, name: s.name, sim: useSim },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [s.longitude, s.latitude],
            [dest.lng, dest.lat],
          ],
        },
      };
    }).filter(Boolean);

    // Look-at line A→B for active station
    const active = displayStations.find((s) => s.id === activeStationId);
    if (plannerMode && active && lookAt) {
      features.push({
        type: "Feature" as const,
        properties: { id: "lookat", name: "B", sim: true },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [active.longitude, active.latitude],
            [lookAt.lng, lookAt.lat],
          ],
        },
      });
    }

    const data = {
      type: "FeatureCollection" as const,
      features: features as {
        type: "Feature";
        properties: Record<string, unknown>;
        geometry: { type: "LineString"; coordinates: number[][] };
      }[],
    };
    const apply = () => {
      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: "geojson", data });
        map.addLayer({
          id: layerId,
          type: "line",
          source: srcId,
          paint: {
            "line-color": "#3d8bfd",
            "line-width": 2.5,
            "line-dasharray": [2, 1],
          },
        });
      } else {
        (map.getSource(srcId) as import("maplibre-gl").GeoJSONSource).setData(
          data,
        );
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);

    // Look-at marker
    lookAtMarkerRef.current?.remove();
    lookAtMarkerRef.current = null;
    if (plannerMode && lookAt) {
      const el = document.createElement("div");
      el.className =
        "flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-ags-accent text-[8px] font-bold text-white shadow";
      el.textContent = "B";
      lookAtMarkerRef.current = new Marker({ element: el })
        .setLngLat([lookAt.lng, lookAt.lat])
        .addTo(map);
    }
  }, [
    displayStations,
    canManage,
    setActiveStationId,
    activeStationId,
    simAzimuthDeg,
    lookAt,
    plannerMode,
  ]);

  const addMarkerHere = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setMarkers((prev) => [
      ...prev,
      {
        id: `m_${Date.now().toString(36)}`,
        lng: c.lng,
        lat: c.lat,
        label: `Метка ${prev.length + 1}`,
      },
    ]);
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-ags-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-2 border-b border-ags-border-subtle p-2 text-xs">
        <select
          className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
          value={tileMode}
          onChange={(e) => setTileMode(e.target.value as TileMode)}
        >
          <option value="offline">Офлайн (встроенные)</option>
          <option value="local">Локальные XYZ</option>
          <option value="osm">OSM онлайн</option>
        </select>
        {tileMode === "local" && (
          <input
            className="min-w-[14rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1"
            placeholder="/tiles/{z}/{x}/{y}.png"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
          />
        )}
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={addMarkerHere}
        >
          Метка в центре
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={() => setMeasureMode((v) => !v)}
        >
          {measureMode ? "Завершить измерение" : "Измерить расстояние"}
        </button>
        {plannerMode && (
          <button
            type="button"
            className={
              pickLookAt
                ? "rounded bg-ags-accent px-2 py-1 text-white"
                : "rounded border border-ags-border px-2 py-1"
            }
            onClick={() => setPickLookAt(!pickLookAt)}
          >
            {pickLookAt ? "Клик: точка B…" : "Точка наблюдения B"}
          </button>
        )}
        <button
          type="button"
          className={
            terrain
              ? "rounded bg-ags-accent px-2 py-1 text-white"
              : "rounded border border-ags-border px-2 py-1"
          }
          onClick={() => {
            setTerrain((v) => !v);
            eventBus.emit(
              "info",
              "map",
              terrain
                ? "3D рельеф выкл"
                : "3D рельеф: Terrarium DEM (Смоленск / Центральная Россия)",
            );
          }}
        >
          3D рельеф {terrain ? "вкл" : "выкл"}
        </button>
        {distanceM != null && (
          <span className="text-ags-muted">
            Дистанция: {(distanceM / 1000).toFixed(3)} км
          </span>
        )}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
