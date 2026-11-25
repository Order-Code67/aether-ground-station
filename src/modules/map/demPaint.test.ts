import { describe, expect, it } from "vitest";
import {
  colormapRgba,
  contourStepM,
  contoursRgba,
  hillshadeRgba,
  mercatorMetersPerPixel,
  spotHeights,
} from "./demPaint";

describe("demPaint", () => {
  it("hillshade keeps size and skips NaN", () => {
    const w = 6;
    const h = 6;
    const elev = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        elev[y * w + x] = x === 0 ? Number.NaN : 100 + x * 8 + y * 3;
      }
    }
    const out = hillshadeRgba(elev, w, h, { cellSizeM: 30, exaggeration: 2 });
    expect(out.length).toBe(w * h * 4);
    expect(out[3]).toBe(0);
    expect(out[(3 * 6 + 3) * 4 + 3]).toBeGreaterThan(0);
  });

  it("contours and spots only use finite elevations", () => {
    const w = 12;
    const h = 8;
    const elev = new Float32Array(w * h);
    elev.fill(Number.NaN);
    for (let y = 0; y < h; y++) {
      for (let x = 4; x < w; x++) {
        elev[y * w + x] = 80 + x * 12;
      }
    }
    const ct = contoursRgba(elev, w, h, 25);
    let opaque = 0;
    for (let i = 3; i < ct.length; i += 4) {
      if (ct[i]! > 0) opaque++;
    }
    expect(opaque).toBeGreaterThan(0);
    const spots = spotHeights(elev, w, h, 25);
    expect(spots.every((s) => Number.isFinite(s.elevM))).toBe(true);
  });

  it("colormap leaves missing pixels transparent", () => {
    const elev = new Float32Array([Number.NaN, 40]);
    const cm = colormapRgba(elev, 2, 1);
    expect(cm[3]).toBe(0);
    expect(cm[7]).toBeGreaterThan(0);
  });

  it("contour step and mercator resolution are sane", () => {
    expect(contourStepM(6)).toBe(100);
    expect(contourStepM(10)).toBe(25);
    expect(contourStepM(13)).toBe(10);
    const mpp = mercatorMetersPerPixel(54.78, 10);
    expect(mpp).toBeGreaterThan(50);
    expect(mpp).toBeLessThan(160);
  });
});
