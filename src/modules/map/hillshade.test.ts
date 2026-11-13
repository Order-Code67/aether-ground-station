import { describe, expect, it } from "vitest";
import { decodeTerrarium, terrariumImageDataToHillshade } from "./hillshade";

describe("hillshade", () => {
  it("decodes terrarium sea level", () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
  });

  it("produces hillshade buffer same size", () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      data[o] = 128;
      data[o + 1] = (i % w) * 8;
      data[o + 2] = 0;
      data[o + 3] = 255;
    }
    const src = { width: w, height: h, data };
    const out = terrariumImageDataToHillshade(src, 1.5);
    expect(out.width).toBe(w);
    expect(out.height).toBe(h);
    expect(out.data.length).toBe(w * h * 4);
  });
});
