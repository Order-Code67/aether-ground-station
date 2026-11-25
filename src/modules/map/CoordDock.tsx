import { useState } from "react";
import { CoordinatePlaceForm } from "@/modules/planner/CoordinatePlaceForm";
import { useGisStore } from "@/stores/gisStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";

/** Side dock: cursor/center readout + lat/lon placement. Not an overlay. */
export function CoordDock({
  centerLat,
  centerLng,
}: {
  centerLat: number;
  centerLng: number;
}) {
  const cursor = useGisStore((s) => s.cursor);
  const [seed, setSeed] = useState<{ lat: string; lng: string; n: number } | null>(
    null,
  );
  const st = useStationPlannerStore((s) => {
    const id = s.activeStationId;
    return s.stations.find((x) => x.id === id) ?? s.stations[0] ?? null;
  });

  const fill = (lat: number, lng: number) => {
    setSeed({ lat: lat.toFixed(6), lng: lng.toFixed(6), n: Date.now() });
  };

  return (
    <aside
      className="flex w-[13.25rem] shrink-0 flex-col gap-2 overflow-auto border-l border-ags-border-subtle bg-ags-panel/95 p-2 text-[10px]"
      data-testid="coord-dock"
    >
      <div className="text-[9px] font-semibold uppercase tracking-wide text-ags-muted">
        Координаты
      </div>
      <dl className="space-y-1 font-mono text-[10px]">
        <div>
          <dt className="text-ags-dim">Курсор</dt>
          <dd className="text-ags-fg">
            {cursor
              ? `${cursor.lat.toFixed(5)}, ${cursor.lng.toFixed(5)}`
              : "наведите на карту"}
          </dd>
          <dd className="text-ags-muted">
            H{" "}
            {cursor?.elevM == null ? "Н/Д" : `${cursor.elevM.toFixed(1)} м`}
            {cursor?.source ? ` · ${cursor.source}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ags-dim">Центр</dt>
          <dd className="text-ags-fg">
            {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
          </dd>
        </div>
        {st && (
          <div>
            <dt className="text-ags-dim">НСУ</dt>
            <dd className="text-ags-fg">
              {st.latitude.toFixed(5)}, {st.longitude.toFixed(5)}
            </dd>
            <dd className="text-ags-muted">
              H{" "}
              {st.terrainElevationM == null
                ? "Н/Д"
                : `${st.terrainElevationM.toFixed(0)} м`}
            </dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded border border-ags-border px-1.5 py-0.5 disabled:opacity-40"
          disabled={!cursor}
          onClick={() => cursor && fill(cursor.lat, cursor.lng)}
        >
          Курсор → поля
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-1.5 py-0.5"
          onClick={() => fill(centerLat, centerLng)}
        >
          Центр → поля
        </button>
      </div>
      <CoordinatePlaceForm seed={seed} />
    </aside>
  );
}
