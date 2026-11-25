import { describe, expect, it } from "vitest";
import {
  honestLatLng,
  honestNumber,
  parseDiagnosticsMessage,
} from "./telemetry";

describe("honest telemetry numbers", () => {
  it("keeps a real zero voltage", () => {
    expect(honestNumber(0)).toBe(0);
  });

  it("drops NaN and non-finite", () => {
    expect(honestNumber(Number.NaN)).toBeNull();
    expect(honestNumber(Infinity)).toBeNull();
    expect(honestNumber("")).toBeNull();
    expect(honestNumber(undefined)).toBeNull();
  });

  it("treats 0,0 GPS as missing, not a fix", () => {
    expect(honestLatLng(0, 0)).toBeNull();
    expect(honestLatLng(54.78, 32.04)).toEqual({ lat: 54.78, lng: 32.04 });
  });

  it("parseDiagnosticsMessage does not invent zeros", () => {
    const m = parseDiagnosticsMessage(
      JSON.stringify({
        device: "esp",
        version: "1",
        status: "online",
        voltage: "not-a-number",
        temperature: Number.NaN,
        lat: 0,
        lon: 0,
      }),
    );
    expect(m).not.toBeNull();
    expect(m!.voltage).toBeNull();
    expect(m!.temperature).toBeNull();
    expect(m!.latitude).toBeNull();
    expect(m!.longitude).toBeNull();
  });
});
