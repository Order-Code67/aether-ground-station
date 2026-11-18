import { describe, expect, it } from "vitest";
import { lon2tile, lat2tile, lonLatToWorldPx, worldPxToLonLat } from "./slippyMath";

describe("slippyMath", () => {
  it("Smolensk tile at z10", () => {
    expect(lon2tile(32.045, 10)).toBe(603);
    expect(lat2tile(54.782, 10)).toBe(324);
  });

  it("round-trips world pixels", () => {
    const z = 9;
    const { x, y } = lonLatToWorldPx(32.045, 54.782, z);
    const { lon, lat } = worldPxToLonLat(x, y, z);
    expect(lon).toBeCloseTo(32.045, 4);
    expect(lat).toBeCloseTo(54.782, 4);
  });
});
