import { describe, expect, it } from "vitest";
import { parseLatLonInput, requirePlannerFix, siteLatLng } from "./parseCoords";

describe("parseLatLonInput", () => {
  it("accepts Smolensk with dot or comma decimals", () => {
    expect(parseLatLonInput("54.782", "32.045")).toEqual({
      ok: true,
      lat: 54.782,
      lng: 32.045,
    });
    const comma = parseLatLonInput("54,782", "32,045");
    expect(comma.ok).toBe(true);
    if (comma.ok) {
      expect(comma.lat).toBeCloseTo(54.782);
      expect(comma.lng).toBeCloseTo(32.045);
    }
  });

  it("parses pasted pair in the lat field", () => {
    const r = parseLatLonInput("54.782, 32.045", "");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lat).toBeCloseTo(54.782);
      expect(r.lng).toBeCloseTo(32.045);
    }
  });

  it("does not treat European lat 54,782 as a pair", () => {
    const r = parseLatLonInput("54,782", "");
    expect(r.ok).toBe(false);
  });

  it("rejects empty, garbage, and GPS 0,0", () => {
    expect(parseLatLonInput("", "").ok).toBe(false);
    expect(parseLatLonInput("abc", "32").ok).toBe(false);
    expect(parseLatLonInput("0", "0").ok).toBe(false);
    expect(parseLatLonInput("0.0", "0.0").ok).toBe(false);
    expect(parseLatLonInput("91", "32").ok).toBe(false);
  });

  it("requirePlannerFix throws instead of origin", () => {
    expect(() => requirePlannerFix(0, 0)).toThrow(/0,0/);
    expect(requirePlannerFix(54.78, 32.04)).toEqual({
      lat: 54.78,
      lng: 32.04,
    });
  });

  it("siteLatLng ignores 0,0 and missing", () => {
    expect(siteLatLng({ latitude: 0, longitude: 0 })).toBeNull();
    expect(siteLatLng({ latitude: null, longitude: 32 })).toBeNull();
    expect(siteLatLng({ latitude: 54.78, longitude: 32.04 })).toEqual({
      lat: 54.78,
      lng: 32.04,
    });
  });
});
