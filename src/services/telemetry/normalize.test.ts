import { describe, expect, it } from "vitest";
import {
  ardupilotJsonAdapter,
  exportTelemetryCsv,
  normalizeTelemetryLine,
  px4JsonAdapter,
} from "./normalize";

describe("telemetry adapters", () => {
  it("keeps missing PX4 fields as null", () => {
    const t = px4JsonAdapter.parse(
      JSON.stringify({
        px4: true,
        battery_status: {},
        vehicle_global_position: {},
        nav_state: "ready",
      }),
    );
    expect(t).not.toBeNull();
    expect(t!.voltageV).toBeNull();
    expect(t!.latitude).toBeNull();
    expect(t!.warnings.some((w) => w.includes("напряжения"))).toBe(true);
  });

  it("parses ArduPilot GLOBAL_POSITION_INT degE7", () => {
    const t = ardupilotJsonAdapter.parse(
      JSON.stringify({
        ardupilot: true,
        GLOBAL_POSITION_INT: { lat: 557500000, lon: 376200000, alt: 120000 },
        SYS_STATUS: { voltage_battery: 12600 },
        mode: "GUIDED",
      }),
    );
    expect(t).not.toBeNull();
    expect(t!.latitude).toBeCloseTo(55.75, 5);
    expect(t!.longitude).toBeCloseTo(37.62, 5);
    expect(t!.altitudeM).toBeCloseTo(120, 5);
    expect(t!.voltageV).toBeCloseTo(12.6, 5);
  });

  it("normalize falls through adapters", () => {
    const t = normalizeTelemetryLine(
      JSON.stringify({ px4: true, status: "online", voltage: 11.1 }),
    );
    expect(t?.adapterId).toBe("px4-json");
    expect(t?.voltageV).toBe(11.1);
  });

  it("does not treat GPS 0,0 as a fix", () => {
    const t = px4JsonAdapter.parse(
      JSON.stringify({
        px4: true,
        vehicle_global_position: { lat: 0, lon: 0 },
        battery_status: { voltage_v: 0 },
        nav_state: "online",
      }),
    );
    expect(t!.latitude).toBeNull();
    expect(t!.longitude).toBeNull();
    expect(t!.voltageV).toBe(0);
  });

  it("CSV leaves missing fields empty instead of 0", () => {
    const csv = exportTelemetryCsv([
      {
        at: "t",
        voltageV: null,
        temperatureC: null,
        latitude: null,
        longitude: null,
        altitudeM: null,
        adapterId: "px4-json",
      },
    ]);
    expect(csv.split("\n")[1]).toBe("t,,,,,,px4-json");
  });
});
