import { useGisStore } from "@/stores/gisStore";

/** Live cursor lat/lng/elev over the map. */
export function CursorHud() {
  const cursor = useGisStore((s) => s.cursor);
  if (!cursor) {
    return (
      <div className="ags-glass-bar pointer-events-none absolute bottom-3 right-3 z-10 px-2 py-1 font-mono text-[10px] text-ags-dim">
        Курсор: наведите на карту
      </div>
    );
  }
  return (
    <div className="ags-glass-bar pointer-events-none absolute bottom-3 right-3 z-10 max-w-xs px-2 py-1 font-mono text-[10px] text-ags-fg">
      <div>
        {cursor.lat.toFixed(5)}°, {cursor.lng.toFixed(5)}°
      </div>
      <div className="text-ags-muted">
        h{" "}
        {cursor.elevM == null
          ? "Н/Д"
          : `${cursor.elevM.toFixed(1)} м AMSL`}
        {cursor.source ? ` · ${cursor.source}` : ""}
      </div>
    </div>
  );
}
