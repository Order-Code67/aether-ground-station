import { useEffect, useState } from "react";
import { MapPanel } from "@/modules/map/MapPanel";
import { TerrainMesh3D } from "@/modules/terrain/TerrainMesh3D";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useTerrainMapStore } from "@/stores/terrainMapStore";
import { calcAntennaCenterAmsl } from "@/services/stations";
import { getTerrainAdapter } from "@/services/terrain/terrainEngine";
import { computeLinkProfile, type LinkProfileResult } from "@/services/terrain/linkProfile";
import { HeightLegend } from "./HeightLegend";
import { LinkSidebar } from "./LinkSidebar";
import { ElevationProfileChart } from "./ElevationProfileChart";
import { AimingControls } from "@/modules/planner/AimingControls";

const TABS = [
  ["map", "Карта"],
  ["3d", "3D-рельеф"],
  ["profile", "Профиль"],
  ["telemetry", "Телеметрия"],
  ["radio", "Радиовидимость"],
  ["antennas", "Антенны"],
] as const;

/**
 * TZ «3D Terrain Map» — map-first tool: 2D slippy + 3D DEM mesh + Fresnel profile.
 * Reuses planner store / MapPanel; no second app; MapLibre not reintroduced.
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
  const seedDemoDrone = useTerrainMapStore((s) => s.seedDemoDrone);
  const effectiveDrone = useTerrainMapStore((s) => s.effectiveDrone);

  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const refresh = useStationPlannerStore((s) => s.refresh);
  const rangeKm = useStationPlannerStore((s) => s.rangeKm);
  const simAz = useStationPlannerStore((s) => s.simAzimuthDeg);
  const st = stations.find((s) => s.id === activeStationId);

  const [profile, setProfile] = useState<LinkProfileResult | null>(null);
  const [stationAmsl, setStationAmsl] = useState<number | null>(null);
  const [droneAmsl, setDroneAmsl] = useState<number | null>(null);
  const [profileH, setProfileH] = useState(168);

  useEffect(() => {
    void hydrate();
    void refresh();
  }, [hydrate, refresh]);

  useEffect(() => {
    if (demoMode) seedDemoDrone();
  }, [demoMode, simAz, rangeKm, activeStationId, seedDemoDrone]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!st) {
        setProfile(null);
        setStationAmsl(null);
        return;
      }
      const mast = st.mastHeightM ?? 15;
      let ant =
        calcAntennaCenterAmsl(
          st.terrainElevationM,
          mast,
          st.antennaOffsetM,
        ) ?? st.antennaCenterAmslM ?? null;
      if (ant == null) {
        const s = await getTerrainAdapter().sample(st.latitude, st.longitude);
        if (s.elevationM != null) ant = s.elevationM + mast;
      }
      if (cancelled) return;
      setStationAmsl(ant);

      const d = effectiveDrone();
      if (d.source === "none") {
        setProfile(null);
        setDroneAmsl(null);
        return;
      }
      let dAmsl = d.amslM;
      if (dAmsl == null) {
        const s = await getTerrainAdapter().sample(d.lat, d.lng);
        if (s.elevationM != null) dAmsl = s.elevationM + (d.aglM ?? 0);
      }
      if (cancelled) return;
      setDroneAmsl(dAmsl ?? null);

      const result = await computeLinkProfile({
        stationLat: st.latitude,
        stationLng: st.longitude,
        stationAntennaAmslM: ant,
        targetLat: d.lat,
        targetLng: d.lng,
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
  ]);

  const drone = effectiveDrone();

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col bg-ags-bg"
      data-testid="terrain-map"
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-ags-border-subtle px-3 py-1.5">
        <span className="mr-2 text-sm font-semibold text-ags-fg">
          Карта / Terrain Map
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
        {demoMode && (
          <span className="rounded border border-amber-500/50 px-2 py-0.5 text-[10px] text-amber-200">
            DEMO
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          {(tab === "map" || tab === "profile" || tab === "radio") && !view3d && (
            <>
              <MapPanel plannerMode />
              {showHeightLegend && <HeightLegend />}
            </>
          )}
          {(tab === "3d" || view3d) && tab !== "antennas" && (
            <div className="absolute inset-0">
              <TerrainMesh3D className="h-full w-full" />
              {showHeightLegend && <HeightLegend />}
              <div className="ags-glass-bar pointer-events-none absolute bottom-3 left-3 z-10 px-2 py-1 text-[10px] text-ags-muted">
                3D DEM mesh · орбита мышью в панели · DEMO/{drone.source}
              </div>
            </div>
          )}
          {tab === "telemetry" && (
            <div className="flex h-full items-center justify-center p-6 text-sm text-ags-muted">
              Телеметрия дрона — модуль «Телеметрия» / COM JSON. Здесь:{" "}
              {drone.source === "live"
                ? "LIVE позиция"
                : drone.source === "demo"
                  ? "DEMO позиция"
                  : "Нет данных позиции"}
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
          demo={demoMode}
        />
      </div>

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
        <ElevationProfileChart
          profile={profile}
          stationLabel={demoMode ? "НСУ" : "НСУ"}
          droneLabel={drone.source === "demo" ? "DEMO дрон" : "Дрон"}
        />
      </div>
    </div>
  );
}
