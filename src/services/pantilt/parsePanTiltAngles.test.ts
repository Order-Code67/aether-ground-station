import { describe, expect, it } from "vitest";
import { parsePanTiltAngles } from "./parsePanTiltAngles";

describe("parsePanTiltAngles", () => {
  it("parses AZ/EL labeled lines", () => {
    expect(parsePanTiltAngles("AZ:12.5 EL:-3.0")).toEqual({
      azimuthDeg: 12.5,
      elevationDeg: -3,
    });
    expect(parsePanTiltAngles("az=1 el=2")).toEqual({
      azimuthDeg: 1,
      elevationDeg: 2,
    });
  });

  it("parses JSON and pair forms", () => {
    expect(parsePanTiltAngles('{"az":10,"el":5}')).toEqual({
      azimuthDeg: 10,
      elevationDeg: 5,
    });
    expect(parsePanTiltAngles("10.5, 20")).toEqual({
      azimuthDeg: 10.5,
      elevationDeg: 20,
    });
  });

  it("returns null when incomplete — no invention", () => {
    expect(parsePanTiltAngles("AZ:12")).toBeNull();
    expect(parsePanTiltAngles("noise")).toBeNull();
    expect(parsePanTiltAngles("")).toBeNull();
  });
});
