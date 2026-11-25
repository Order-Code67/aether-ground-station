/** Paint hillshade / hypsometric tint / isolines from an elevation grid. */

import { elevToRgb } from "@/services/terrain/heightColor";

export function contourStepM(zoom: number): number {
  if (zoom <= 7) return 100;
  if (zoom <= 9) return 50;
  if (zoom <= 11) return 25;
  return 10;
}

/** Web-Mercator ground resolution at latitude (256 px tiles). */
export function mercatorMetersPerPixel(latDeg: number, zoom: number): number {
  const lat = Math.max(-85.051128, Math.min(85.051128, latDeg));
  return (
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom)
  );
}

export function hillshadeRgba(
  elev: Float32Array,
  w: number,
  h: number,
  opts?: { exaggeration?: number; cellSizeM?: number },
): Uint8ClampedArray {
  const exaggeration = opts?.exaggeration ?? 1.6;
  const cell = Math.max(1, opts?.cellSizeM ?? 30);
  const od = new Uint8ClampedArray(w * h * 4);
  const az = (315 * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const zFactor = exaggeration / cell;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elev[i]!;
      const o = i * 4;
      if (!Number.isFinite(e)) {
        od[o + 3] = 0;
        continue;
      }
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);
      const eX1 = pick(elev, y * w + x1, e);
      const eX0 = pick(elev, y * w + x0, e);
      const eY1 = pick(elev, y1 * w + x, e);
      const eY0 = pick(elev, y0 * w + x, e);
      const dzdx = (eX1 - eX0) / Math.max(1, x1 - x0);
      const dzdy = (eY1 - eY0) / Math.max(1, y1 - y0);
      const slope = Math.atan(zFactor * Math.hypot(dzdx, dzdy));
      const aspect =
        dzdx === 0 && dzdy === 0 ? 0 : Math.atan2(dzdy, -dzdx);
      let shade =
        Math.sin(alt) * Math.cos(slope) +
        Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect);
      shade = Math.max(0, Math.min(1, shade));
      const v = Math.round(shade * 255);
      od[o] = v;
      od[o + 1] = v;
      od[o + 2] = v;
      od[o + 3] = Math.round(165 * (0.28 + 0.72 * (1 - shade * 0.85)));
    }
  }
  return od;
}

export function colormapRgba(
  elev: Float32Array,
  w: number,
  h: number,
): Uint8ClampedArray {
  const od = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const e = elev[i]!;
    if (!Number.isFinite(e)) {
      od[p + 3] = 0;
      continue;
    }
    const [r, g, b] = elevToRgb(e);
    od[p] = r;
    od[p + 1] = g;
    od[p + 2] = b;
    od[p + 3] = 150;
  }
  return od;
}

export function contoursRgba(
  elev: Float32Array,
  w: number,
  h: number,
  stepM = 25,
): Uint8ClampedArray {
  const od = new Uint8ClampedArray(w * h * 4);
  const step = Math.max(1, stepM);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const e = elev[i]!;
      const right = elev[i + 1]!;
      const down = elev[i + w]!;
      if (
        !Number.isFinite(e) ||
        !Number.isFinite(right) ||
        !Number.isFinite(down)
      ) {
        continue;
      }
      const level = Math.floor(e / step);
      if (level !== Math.floor(right / step) || level !== Math.floor(down / step)) {
        const o = i * 4;
        const major = e % (step * 5) < step;
        od[o] = major ? 255 : 228;
        od[o + 1] = major ? 236 : 220;
        od[o + 2] = major ? 200 : 176;
        od[o + 3] = major ? 230 : 175;
      }
    }
  }
  return od;
}

export interface SpotHeight {
  col: number;
  row: number;
  elevM: number;
}

/** Sparse labels on round contour values (only where elevation is known). */
export function spotHeights(
  elev: Float32Array,
  w: number,
  h: number,
  stepM: number,
  maxLabels = 28,
): SpotHeight[] {
  const step = Math.max(1, stepM);
  const out: SpotHeight[] = [];
  const strideX = Math.max(4, Math.floor(w / 7));
  const strideY = Math.max(4, Math.floor(h / 5));
  for (let y = strideY; y < h - 1 && out.length < maxLabels; y += strideY) {
    for (let x = strideX; x < w - 1 && out.length < maxLabels; x += strideX) {
      const e = elev[y * w + x]!;
      if (!Number.isFinite(e)) continue;
      const rounded = Math.round(e / step) * step;
      if (Math.abs(e - rounded) > step * 0.45) continue;
      out.push({ col: x, row: y, elevM: rounded });
    }
  }
  return out;
}

function pick(elev: Float32Array, i: number, fallback: number): number {
  const v = elev[i];
  return v != null && Number.isFinite(v) ? v : fallback;
}
