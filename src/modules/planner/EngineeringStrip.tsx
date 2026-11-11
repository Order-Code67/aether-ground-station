import { TerrainPanel } from "@/modules/terrain/TerrainPanel";
import { PanTiltPanel } from "@/modules/pantilt/PanTiltPanel";
import { PanTiltScene3D } from "@/modules/pantilt/PanTiltScene3D";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";

/** Bottom engineering pane: terrain profile + pan-tilt + 3D. */
export function EngineeringStrip() {
  const az = useStationPlannerStore((s) => s.simAzimuthDeg);
  const el = useStationPlannerStore((s) => s.simElevationDeg);
  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const st = stations.find((s) => s.id === activeStationId);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 divide-y divide-ags-border-subtle md:grid-cols-3 md:divide-x md:divide-y-0">
      <section className="min-h-0 overflow-hidden" aria-label="Профиль рельефа">
        <div className="border-b border-ags-border-subtle px-2 py-1 text-[10px] font-semibold uppercase text-ags-muted">
          Профиль рельефа
        </div>
        <div className="h-[calc(100%-1.5rem)] min-h-0">
          <TerrainPanel coupled compact />
        </div>
      </section>
      <section className="min-h-0 overflow-hidden" aria-label="Поворотный механизм">
        <div className="border-b border-ags-border-subtle px-2 py-1 text-[10px] font-semibold uppercase text-ags-muted">
          Поворотный механизм
        </div>
        <div className="h-[calc(100%-1.5rem)] min-h-0">
          <PanTiltPanel compact />
        </div>
      </section>
      <section className="min-h-0 overflow-hidden" aria-label="3D модель">
        <div className="border-b border-ags-border-subtle px-2 py-1 text-[10px] font-semibold uppercase text-ags-muted">
          3D модель
        </div>
        <div className="h-[calc(100%-1.5rem)] min-h-0">
          <PanTiltScene3D
            azimuthDeg={az}
            elevationDeg={el}
            mastHeightM={st?.mastHeightM}
            className="h-full"
          />
        </div>
      </section>
    </div>
  );
}
