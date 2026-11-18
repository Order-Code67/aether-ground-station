import { useEffect, useState } from "react";
import { MapPanel } from "@/modules/map/MapPanel";
import { TerrainMesh3D } from "@/modules/terrain/TerrainMesh3D";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useTerrainMapStore } from "@/stores/terrainMapStore";
import { useGisStore } from "@/stores/gisStore";
import { calcAntennaCenterAmsl } from "@/services/stations";
import { getTerrainAdapter } from "@/services/terrain/terrainEngine";
import { restoreGeoTiffOrTerrarium } from "@/services/terrain/geotiffDem";
import {
  computeLinkProfile,
  type LinkProfileResult,
} from "@/services/terrain/linkProfile";
import { HeightLegend } from "./HeightLegend";
import { LinkSidebar } from "./LinkSidebar";
import { ElevationProfileChart } from "./ElevationProfileChart";
import { AimingControls } from "@/modules/planner/AimingControls";
import { LayerPanel } from "./LayerPanel";
import { ToolsPanel } from "./ToolsPanel";
import { CursorHud } from "./CursorHud";

const TABS = [
  ["map", "Карта"],
  ["3d", "3D-рельеф"],
  ["profile", "Профиль"],
  ["telemetry", "Телеметрия"],
  ["radio", "Радиовидимость"],
  ["antennas", "Антенны"],
] as const;

/**
 * Terrain & GIS shell — slippy 2D + Three.js 3D + Fresnel profile.
 * MapLibre not used as basemap (product constraint).
 */
export function TerrainMapView() {
  const tab = useTerrainMapStore((s) => s.tab);
  const setTab = useTerrainMapStore((s) => s.setTab);
  const view3d = useTerrainMapStore((s) => s.view3d);
  const setView3d = useTerrainMapStore((s) => s.setView3d);
  const showHeightLegend = useTerrainMapStore((s) => s.showHeightLegend);
  const demoMode = useTerrainMapStore((s) => s.demoMode);
  const freqGhz = useTerrainMapStore((s) => s.freqGhz);
  const hydrate = useTerrainMapStore((s) => s.hydrate);
  const effectiveDrone = useTerrainMapStore((s) => s.effectiveDrone);
  const syncLookAtFromAzimuth = useStationPlannerStore(
    (s) => s.syncLookAtFromAzimuth,
  );

  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const refresh = useStationPlannerStore((s) => s.refresh);
  const rangeKm = useStationPlannerStore((s) => s.rangeKm);
  const simAz = useStationPlannerStore((s) => s.simAzimuthDeg);
  const st = stations.find((s) => s.id === activeStationId);

  const leftOpen = useGisStore((s) => s.leftPanelOpen);
  const setLeftOpen = useGisStore((s) => s.setLeftPanelOpen);
  const bottomOpen = useGisStore((s) => s.bottomPanelOpen);
  const setBottomOpen = useGisStore((s) => s.setBottomPanelOpen);
  const hydrateGis = useGisStore((s) => s.hydrate);
  const layers = useGisStore((s) => s.layers);
  const profileA = useGisStore((s) => s.profileOverrideA);
  const profileB = useGisStore((s) => s.profileOverrideB);
  const [leftTab, setLeftTab] = useState<"layers" | "tools">("layers");

  const [profile, setProfile] = useState<LinkProfileResult | null>(null);
  const [stationAmsl, setStationAmsl] = useState<number | null>(null);
  const [droneAmsl, setDroneAmsl] = useState<number | null>(null);
  const [profileH, setProfileH] = useState(168);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    void hydrate();
    void refresh();
    void hydrateGis();
    void restoreGeoTiffOrTerrarium();
  }, [hydrate, refresh, hydrateGis]);

  useEffect(() => {
    if (!demoMode) syncLookAtFromAzimuth();
  }, [demoMode, simAz, rangeKm, activeStationId, syncLookAtFromAzimuth]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const drone = effectiveDrone();
      const aLat = profileA?.lat ?? st?.latitude;
      const aLng = profileA?.lng ?? st?.longitude;
      const bLat = profileB?.lat ?? (drone.source !== "none" ? drone.lat : null);
      const bLng = profileB?.lng ?? (drone.source !== "none" ? drone.lng : null);

      if (aLat == null || aLng == null || bLat == null || bLng == null) {
        setProfile(null);
        setStationAmsl(null);
        setDroneAmsl(null);
        return;
      }

      const mast = st?.mastHeightM ?? 15;
      let ant =
        st != null
          ? calcAntennaCenterAmsl(
              st.terrainElevationM,
              mast,
              st.antennaOffsetM,
            )
          : null;
      if (ant == null) {
        const s = await getTerrainAdapter().sample(aLat, aLng);
        if (!s.missing && s.elevationM != null) {
          ant = s.elevationM + (profileA ? 0 : mast);
        }
      }
      if (cancelled) return;
      setStationAmsl(ant);

      let dAmsl = drone.amslM;
      if (dAmsl == null && drone.aglM != null) {
        const s = await getTerrainAdapter().sample(bLat, bLng);
        if (!s.missing && s.elevationM != null) dAmsl = s.elevationM + drone.aglM;
      }
      if (dAmsl == null && profileB) {
        const s = await getTerrainAdapter().sample(bLat, bLng);
        if (!s.missing) dAmsl = s.elevationM;
      }
      if (cancelled) return;
      setDroneAmsl(dAmsl ?? null);

      const result = await computeLinkProfile({
        stationLat: aLat,
        stationLng: aLng,
        stationAntennaAmslM: ant,
        targetLat: bLat,
        targetLng: bLng,
        targetAmslM: dAmsl ?? null,
        freqGhz,
        steps: 48,
      });
      if (!cancelled) setProfile(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    st?.id,
    st?.latitude,
    st?.longitude,
    st?.mastHeightM,
    st?.terrainElevationM,
    st?.antennaOffsetM,
    st?.antennaCenterAmslM,
    freqGhz,
    simAz,
    rangeKm,
    demoMode,
    effectiveDrone,
    profileA?.lat,
    profileA?.lng,
    profileB?.lat,
    profileB?.lng,
  ]);

  const drone = effectiveDrone();

  const shellClass = fullscreen
    ? "fixed inset-0 z-[80] flex flex-col bg-ags-bg"
    : "relative flex h-full min-h-0 w-full flex-col bg-ags-bg";

  return (
    <div className={shellClass} data-testid="terrain-map">
      <div className="flex flex-wrap items-center gap-1 border-b border-ags-border-subtle px-3 py-1.5">
        <span className="mr-2 text-sm font-semibold text-ags-fg">
          Terrain & GIS
        </span>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              tab === id
                ? "rounded bg-ags-accent px-2.5 py-1 text-xs text-white"
                : "rounded border border-ags-border px-2.5 py-1 text-xs text-ags-muted"
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={
            view3d
              ? "ml-auto rounded bg-ags-elevated px-2 py-1 text-xs text-ags-accent"
              : "ml-auto rounded border border-ags-border px-2 py-1 text-xs"
          }
          onClick={() => setView3d(!view3d)}
        >
          3D
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1 text-xs"
          onClick={() => setLeftOpen(!leftOpen)}
        >
          {leftOpen ? "Слои ▾" : "Слои"}
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1 text-xs"
          onClick={() => setBottomOpen(!bottomOpen)}
        >
          Профиль
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1 text-xs"
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? "Выйти" : "Полный экран"}
        </button>
        {demoMode && (
          <span className="rounded bg-amber-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
            DEMO
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {leftOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-ags-border-subtle bg-ags-panel/95">
            <div className="flex gap-1 border-b border-ags-border-subtle p-1">
              <button
                type="button"
                className={
                  leftTab === "layers"
                    ? "flex-1 rounded bg-ags-elevated py-1 text-[10px]"
                    : "flex-1 rounded py-1 text-[10px] text-ags-muted"
                }
                onClick={() => setLeftTab("layers")}
              >
                Слои
              </button>
              <button
                type="button"
                className={
                  leftTab === "tools"
                    ? "flex-1 rounded bg-ags-elevated py-1 text-[10px]"
                    : "flex-1 rounded py-1 text-[10px] text-ags-muted"
                }
                onClick={() => setLeftTab("tools")}
              >
                Инструменты
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {leftTab === "layers" ? <LayerPanel /> : <ToolsPanel />}
            </div>
          </aside>
        )}

        <div className="relative min-h-0 min-w-0 flex-1">
          {(tab === "map" || tab === "profile" || tab === "radio") &&
            !view3d && (
              <>
                <MapPanel plannerMode />
                {(showHeightLegend || layers.demColormap) && <HeightLegend />}
                <CursorHud />
              </>
            )}
          {(tab === "3d" || view3d) && tab !== "antennas" && (
            <div className="absolute inset-0 z-[1] flex min-h-0 flex-col bg-ags-bg">
              <TerrainMesh3D className="h-full min-h-0 w-full flex-1" />
              {(showHeightLegend || layers.demColormap) && <HeightLegend />}
              <div className="ags-glass-bar pointer-events-none absolute bottom-3 left-3 z-10 max-w-sm px-2 py-1 text-[10px] text-ags-muted">
                Офлайн Terrarium · вертикальный масштаб — преувеличение (см.
                слои)
                {st ? ` · ${st.name}` : " · центр Смоленск"}
              </div>
            </div>
          )}
          {tab === "telemetry" && (
            <div className="flex h-full flex-col items-start justify-center gap-2 p-6 text-sm text-ags-muted">
              <p>
                Телеметрия дрона — модуль «Телеметрия» / COM JSON. Цель на карте:{" "}
                {drone.source === "live"
                  ? "LIVE позиция"
                  : drone.source === "lookAt"
                    ? "точка направления (B)"
                    : drone.source === "demo"
                      ? "DEMO дрон"
                      : "Нет данных позиции"}
              </p>
              {drone.source === "live" && (
                <p className="font-mono text-xs text-ags-fg">
                  {drone.lat.toFixed(5)}, {drone.lng.toFixed(5)}
                  {drone.amslM != null ? ` · ${drone.amslM.toFixed(0)} м AMSL` : ""}
                </p>
              )}
            </div>
          )}
          {tab === "radio" && (
            <div className="pointer-events-none absolute bottom-14 left-3 z-10 max-w-md rounded border border-ags-warning/40 bg-ags-bg/90 p-2 text-[10px] text-ags-muted">
              Анализ DEM/Френеля — геометрическая видимость, не модель
              радиоканала. Не учитывает помехи, многолучевость, поляризацию и
              препятствия вне DEM.
            </div>
          )}
          {tab === "antennas" && (
            <div className="h-full overflow-auto">
              <AimingControls />
            </div>
          )}
        </div>

        <LinkSidebar
          distanceM={profile?.distanceM ?? null}
          deltaHeightM={profile?.deltaHeightM ?? null}
          azimuthDeg={profile?.azimuthDeg ?? null}
          elevationDeg={profile?.elevationDeg ?? null}
          stationAmsl={stationAmsl}
          droneAmsl={droneAmsl}
          status={profile?.status ?? "unknown"}
        />
      </div>

      {bottomOpen && (
        <div
          className="shrink-0 border-t border-ags-border-subtle bg-ags-panel/95"
          style={{ height: profileH }}
        >
          <div
            className="h-1 cursor-row-resize bg-ags-border/40 hover:bg-ags-accent/40"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = profileH;
              const onMove = (ev: MouseEvent) => {
                setProfileH(
                  Math.min(320, Math.max(100, startH - (ev.clientY - startY))),
                );
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          />
          <div className="flex items-center justify-between px-2 py-0.5 text-[9px] text-ags-dim">
            <span>
              Профиль высот · Френеля{" "}
              {layers.fresnel ? "вкл" : "выкл в слоях"} · не гарантия RF
            </span>
            <span>
              {profile
                ? `${(profile.distanceM / 1000).toFixed(2)} км · Δh ${
                    profile.deltaHeightM?.toFixed(0) ?? "Н/Д"
                  } м`
                : "Нет линии A–B"}
            </span>
          </div>
          <ElevationProfileChart
            profile={layers.fresnel || layers.los ? profile : profile}
            stationLabel={profileA ? "A" : "НСУ"}
            droneLabel={
              profileB
                ? "B"
                : drone.source === "live"
                  ? "Дрон"
                  : drone.source === "lookAt"
                    ? "Цель"
                    : drone.source === "demo"
                      ? "DEMO"
                      : "Цель"
            }
          />
        </div>
      )}
    </div>
  );
}
