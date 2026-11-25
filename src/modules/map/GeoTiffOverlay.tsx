import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";
import { getDemMeta } from "@/services/terrain/terrainEngine";
import {
  colormapRgba,
  contourStepM,
  contoursRgba,
  hillshadeRgba,
  mercatorMetersPerPixel,
  spotHeights,
} from "./demPaint";

export interface ElevationGridDto {
  west: number;
  south: number;
  east: number;
  north: number;
  cols: number;
  rows: number;
  values: Array<number | null>;
  known: number;
  message: string;
}

/** Viewport DEM overlay sampled from the loaded GeoTIFF (NaN → transparent). */
export function GeoTiffOverlay({
  west,
  south,
  east,
  north,
  width,
  height,
  zoom,
  path,
  showRelief,
  showColormap,
  showContours,
  reliefOpacity,
  colormapOpacity,
  exaggeration,
  project,
}: {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
  zoom: number;
  path: string;
  showRelief: boolean;
  showColormap: boolean;
  showContours: boolean;
  reliefOpacity: number;
  colormapOpacity: number;
  exaggeration: number;
  project: (lon: number, lat: number) => { x: number; y: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spots, setSpots] = useState<
    { lon: number; lat: number; elevM: number }[]
  >([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriRuntime() || !path || width < 8 || height < 8) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const cols = Math.max(48, Math.min(256, Math.round(width / 8)));
          const rows = Math.max(32, Math.min(192, Math.round(height / 8)));
          const grid = await invoke<ElevationGridDto>("terrain_sample_grid", {
            path,
            west,
            south,
            east,
            north,
            cols,
            rows,
          });
          if (cancelled) return;
          const elev = new Float32Array(grid.cols * grid.rows);
          for (let i = 0; i < elev.length; i++) {
            const v = grid.values[i];
            elev[i] = v == null || !Number.isFinite(v) ? Number.NaN : v;
          }
          const cell = mercatorMetersPerPixel((south + north) / 2, zoom);
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = grid.cols;
          canvas.height = grid.rows;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const img = ctx.createImageData(grid.cols, grid.rows);
          img.data.fill(0);
          if (showColormap) {
            blit(img.data, colormapRgba(elev, grid.cols, grid.rows), colormapOpacity);
          }
          if (showRelief) {
            blit(
              img.data,
              hillshadeRgba(elev, grid.cols, grid.rows, {
                exaggeration,
                cellSizeM: cell,
              }),
              reliefOpacity,
            );
          }
          const step = contourStepM(zoom);
          if (showContours) {
            blit(img.data, contoursRgba(elev, grid.cols, grid.rows, step), 0.9);
            const dlon = (east - west) / grid.cols;
            const dlat = (north - south) / grid.rows;
            setSpots(
              spotHeights(elev, grid.cols, grid.rows, step).map((s) => ({
                lon: west + (s.col + 0.5) * dlon,
                lat: north - (s.row + 0.5) * dlat,
                elevM: s.elevM,
              })),
            );
          } else {
            setSpots([]);
          }
          ctx.putImageData(img, 0, 0);
          setNote(
            grid.known === 0
              ? "GeoTIFF: в кадре нет высот (Н/Д)"
              : `${getDemMeta().name} · ${grid.known} точек`,
          );
        } catch (e) {
          if (!cancelled) {
            setNote(e instanceof Error ? e.message : "GeoTIFF overlay Н/Д");
            setSpots([]);
          }
        }
      })();
    }, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [
    west,
    south,
    east,
    north,
    width,
    height,
    zoom,
    path,
    showRelief,
    showColormap,
    showContours,
    reliefOpacity,
    colormapOpacity,
    exaggeration,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {showContours &&
        spots.map((s, i) => {
          const p = project(s.lon, s.lat);
          if (p.x < 10 || p.y < 10 || p.x > width - 10 || p.y > height - 10) {
            return null;
          }
          return (
            <div
              key={`${i}-${s.elevM}`}
              className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-1 py-px font-mono text-[9px] text-amber-100"
              style={{ left: p.x, top: p.y }}
            >
              {s.elevM.toFixed(0)}
            </div>
          );
        })}
      {note && (
        <div className="pointer-events-none absolute bottom-12 left-3 z-[2] rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-ags-muted">
          {note}
        </div>
      )}
    </>
  );
}

function blit(dst: Uint8ClampedArray, src: Uint8ClampedArray, opacity: number) {
  for (let i = 0; i < dst.length; i += 4) {
    const a = (src[i + 3]! / 255) * opacity;
    if (a <= 0) continue;
    const ia = 1 - a;
    dst[i] = Math.round(src[i]! * a + dst[i]! * ia);
    dst[i + 1] = Math.round(src[i + 1]! * a + dst[i + 1]! * ia);
    dst[i + 2] = Math.round(src[i + 2]! * a + dst[i + 2]! * ia);
    dst[i + 3] = Math.min(255, Math.round(dst[i + 3]! * ia + a * 255));
  }
}
