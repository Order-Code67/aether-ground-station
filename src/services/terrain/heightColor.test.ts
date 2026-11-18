import { describe, expect, it } from "vitest";
import { elevToRgb, HEIGHT_STOPS } from "./heightColor";
import {
  decodeTerrarium,
  terrariumImageDataToColormap,
  terrariumImageDataToContours,
} from "@/modules/map/hillshade";

describe("heightColor", () => {
  it("maps low elevations to dark green band", () => {
    const [r, g, b] = elevToRgb(20);
    expect([r, g, b]).toEqual(HEIGHT_STOPS[0]!.rgb);
  });

  it("maps high elevations to red/brown band", () => {
    const [r, g, b] = elevToRgb(400);
    expect([r, g, b]).toEqual(HEIGHT_STOPS[HEIGHT_STOPS.length - 1]!.rgb);
  });
});

describe("terrarium overlays", () => {
  it("decodes Mapzen terrarium RGB", () => {
    // elevation 0 ≈ RGB encoding of 32768
    expect(decodeTerrarium(128, 0, 0)).toBeCloseTo(0, 5);
  });

  it("colormap leaves ocean/nodata transparent-ish when elev invalid", () => {
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    // encode elev -1000 → very low r
    for (let i = 0; i < w * h; i++) {
      const p = i * 4;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
      data[p + 3] = 255;
    }
    const cm = terrariumImageDataToColormap({ width: w, height: h, data });
    expect(cm.data[3]).toBe(0);
  });

  it("contours produce some opaque pixels on sloping tile", () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const elev = x * 30 + y * 10; // meters
        const enc = elev + 32768;
        const r = Math.floor(enc / 256);
        const g = Math.floor(enc % 256);
        const b = Math.round((enc - r * 256 - g) * 256);
        const p = (y * w + x) * 4;
        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = Math.min(255, b);
        data[p + 3] = 255;
      }
    }
    const ct = terrariumImageDataToContours({ width: w, height: h, data }, 25);
    let opaque = 0;
    for (let i = 3; i < ct.data.length; i += 4) {
      if ((ct.data[i] ?? 0) > 0) opaque++;
    }
    expect(opaque).toBeGreaterThan(0);
  });
});
