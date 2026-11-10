import { describe, expect, it } from "vitest";
import { offlineStyle, OSM_STYLE } from "./mapStyles";

describe("map offline / XYZ styles", () => {
  it("offline has no external tile sources", () => {
    const s = offlineStyle();
    expect(Object.keys(s.sources ?? {})).toHaveLength(0);
    expect(s.layers?.some((l) => l.type === "background")).toBe(true);
  });

  it("local XYZ uses provided template", () => {
    const url = "http://127.0.0.1:8080/{z}/{x}/{y}.png";
    const s = offlineStyle(url);
    const src = s.sources?.local as { tiles?: string[] } | undefined;
    expect(src?.tiles?.[0]).toBe(url);
  });

  it("OSM style points at openstreetmap tiles", () => {
    const src = OSM_STYLE.sources.osm as { tiles?: string[] };
    expect(src.tiles?.[0]).toContain("openstreetmap.org");
  });
});
