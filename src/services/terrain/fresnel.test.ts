import { describe, expect, it } from "vitest";
import {
  classifyFresnelClearance,
  fresnelRadiusM,
  radioVisibilityLabel,
} from "./fresnel";

describe("fresnelRadiusM", () => {
  it("returns positive F1 for mid-path 5.8 GHz over 10 km", () => {
    const r = fresnelRadiusM(5, 5, 10, 5.8);
    expect(r).toBeGreaterThan(5);
    expect(r).toBeLessThan(80);
  });

  it("grows when frequency drops", () => {
    const hi = fresnelRadiusM(5, 5, 10, 5.8);
    const lo = fresnelRadiusM(5, 5, 10, 1.2);
    expect(lo).toBeGreaterThan(hi);
  });
});

describe("classifyFresnelClearance", () => {
  it("unknown when clearance null", () => {
    expect(classifyFresnelClearance(null, false)).toBe("unknown");
  });
  it("blocked when LOS blocked", () => {
    expect(classifyFresnelClearance(20, true)).toBe("blocked");
  });
  it("clear when well above F1 floor", () => {
    expect(classifyFresnelClearance(20, false)).toBe("clear");
  });
  it("labels are non-empty Russian strings", () => {
    expect(radioVisibilityLabel("clear").length).toBeGreaterThan(3);
  });
});
