import { describe, expect, it } from "vitest";
import {
  classifyFresnelClearance,
  fresnelRadiusM,
  radioVisibilityLabel,
} from "./fresnel";

describe("fresnel", () => {
  it("computes first zone radius", () => {
    // Midpoint 10 km link @ 5.8 GHz: d1=d2=5, D=10
    const r = fresnelRadiusM(5, 5, 10, 5.8);
    expect(r).toBeGreaterThan(10);
    expect(r).toBeLessThan(40);
  });

  it("classifies clearance honestly", () => {
    expect(classifyFresnelClearance(null, false)).toBe("unknown");
    expect(classifyFresnelClearance(-1, true)).toBe("blocked");
    expect(classifyFresnelClearance(2, false)).toBe("fresnel_partial");
    expect(classifyFresnelClearance(20, false)).toBe("clear");
  });

  it("labels in Russian", () => {
    expect(radioVisibilityLabel("clear")).toMatch(/видимост/i);
  });
});
