import { useEffect, useState } from "react";
import { getTerrainAdapter } from "@/services/terrain/terrainEngine";
import { contourStepM } from "./demPaint";

/** Sparse AMSL labels from the active DEM — skipped where height is missing. */
export function ElevationSpotLabels({
  west,
  south,
  east,
  north,
  zoom,
  project,
  size,
}: {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  project: (lon: number, lat: number) => { x: number; y: number };
  size: { w: number; h: number };
}) {
  const [spots, setSpots] = useState<{ lon: number; lat: number; elevM: number }[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const adapter = getTerrainAdapter();
        const cols = 6;
        const rows = 4;
        const step = contourStepM(zoom);
        const next: { lon: number; lat: number; elevM: number }[] = [];
        for (let r = 1; r < rows; r++) {
          for (let c = 1; c < cols; c++) {
            const lon = west + ((east - west) * c) / cols;
            const lat = north - ((north - south) * r) / rows;
            const s = await adapter.sample(lat, lon);
            if (cancelled) return;
            if (s.missing || s.elevationM == null || !Number.isFinite(s.elevationM)) {
              continue;
            }
            const rounded = Math.round(s.elevationM / step) * step;
            next.push({ lon, lat, elevM: rounded });
          }
        }
        if (!cancelled) setSpots(next);
      })();
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [west, south, east, north, zoom]);

  return (
    <>
      {spots.map((s, i) => {
        const p = project(s.lon, s.lat);
        if (p.x < 8 || p.y < 8 || p.x > size.w - 8 || p.y > size.h - 8) {
          return null;
        }
        return (
          <div
            key={`${s.lon.toFixed(4)}-${s.lat.toFixed(4)}-${i}`}
            className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2 rounded bg-black/55 px-1 py-px font-mono text-[9px] text-amber-100/90"
            style={{ left: p.x, top: p.y }}
          >
            {s.elevM.toFixed(0)}
          </div>
        );
      })}
    </>
  );
}
