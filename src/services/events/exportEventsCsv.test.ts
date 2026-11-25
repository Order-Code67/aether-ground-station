import { describe, expect, it } from "vitest";
import { diagnosticsToCsv, eventsToCsv } from "./exportEventsCsv";

describe("eventsToCsv", () => {
  it("escapes commas in messages", () => {
    const csv = eventsToCsv([
      {
        id: "1",
        at: "2026-01-01T00:00:00.000Z",
        severity: "error",
        source: "map",
        message: "GPS 0,0 rejected",
      },
    ]);
    expect(csv).toContain("at,severity,source,message");
    expect(csv).toContain('"GPS 0,0 rejected"');
  });
});

describe("diagnosticsToCsv", () => {
  it("writes module rows", () => {
    const csv = diagnosticsToCsv([
      {
        id: "d1",
        at: "2026-01-01T00:00:00.000Z",
        module: "serial",
        severity: "warning",
        description: "port lost",
      },
    ]);
    expect(csv.split("\n")[1]).toContain("serial");
  });
});
