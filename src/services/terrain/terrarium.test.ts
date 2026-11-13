import { describe, expect, it } from "vitest";
import { decodeTerrariumRgb } from "./terrainEngine";

describe("decodeTerrariumRgb", () => {
  it("decodes sea-level / mid elevations", () => {
    // elevation = R*256 + G + B/256 - 32768
    // 0 m → R=128, G=0, B=0
    expect(decodeTerrariumRgb(128, 0, 0)).toBe(0);
    // 240 m → R=128, G=240, B=0
    expect(decodeTerrariumRgb(128, 240, 0)).toBe(240);
  });

  it("decodes below-sea (negative)", () => {
    // -100 m → R=127, G=156, B=0  (127*256 + 156 - 32768 = -100)
    expect(decodeTerrariumRgb(127, 156, 0)).toBe(-100);
  });
});
