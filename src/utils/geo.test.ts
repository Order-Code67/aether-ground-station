import { describe, expect, it } from "vitest";
import {
  bearingDeg,
  clampAngle,
  destinationPoint,
  haversineM,
} from "./geo";

describe("geo helpers", () => {
  it("haversine distance Moscow approx", () => {
    const d = haversineM(
      { lat: 55.75, lng: 37.62 },
      { lat: 55.76, lng: 37.62 },
    );
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });

  it("destination + bearing round-trip north", () => {
    const a = { lat: 55.75, lng: 37.62 };
    const b = destinationPoint(a.lat, a.lng, 0, 2500);
    expect(b.lat).toBeGreaterThan(a.lat);
    const brg = bearingDeg(a, b);
    expect(brg).toBeGreaterThanOrEqual(0);
    expect(brg).toBeLessThan(5);
  });

  it("clampAngle respects pan-tilt ranges", () => {
    expect(clampAngle(200, -120, 120)).toBe(120);
    expect(clampAngle(-200, -120, 120)).toBe(-120);
    expect(clampAngle(45, -120, 120)).toBe(45);
  });
});
