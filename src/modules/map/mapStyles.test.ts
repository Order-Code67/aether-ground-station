import { describe, expect, it } from "vitest";
import {
  BUNDLED_OFFLINE_TILES,
  CARTO_DARK_ALL_TILES,
  CARTO_DARK_LABELS_TILES,
  CARTO_DARK_STYLE,
  mapAttribution,
  offlineStyle,
  OSM_CARTO_TILES,
  OSM_STYLE,
} from "./mapStyles";

describe("map offline / XYZ styles", () => {
  it("default offline uses bundled local tiles (no CDN)", () => {
    const s = offlineStyle();
    const src = s.sources?.local as { tiles?: string[] } | undefined;
    expect(src?.tiles?.[0]).toContain(BUNDLED_OFFLINE_TILES);
    expect(src?.tiles?.[0]).not.toMatch(/^https?:\/\/(?!localhost)/);
    expect(s.layers?.some((l) => l.type === "background")).toBe(true);
  });

  it("local XYZ uses provided template", () => {
    const url = "http://127.0.0.1:8080/{z}/{x}/{y}.png";
    const s = offlineStyle(url);
    const src = s.sources?.local as { tiles?: string[] } | undefined;
    expect(src?.tiles?.[0]).toBe(url);
  });

  it("OSM Carto points at openstreetmap.org (ODbL)", () => {
    const src = OSM_STYLE.sources.osm as { tiles?: string[]; attribution?: string };
    expect(src.tiles?.[0]).toBe(OSM_CARTO_TILES);
    expect(src.tiles?.[0]).toContain("openstreetmap.org");
    expect(src.attribution).toMatch(/OpenStreetMap/);
  });

  it("CARTO Dark Matter is OSM-derived, not Google/Mapbox", () => {
    expect(CARTO_DARK_ALL_TILES).toContain("basemaps.cartocdn.com");
    expect(CARTO_DARK_ALL_TILES).toContain("dark_all");
    expect(CARTO_DARK_LABELS_TILES).toContain("dark_only_labels");
    expect(CARTO_DARK_ALL_TILES).not.toMatch(/google|mapbox|googleapis/i);
    const src = CARTO_DARK_STYLE.sources.carto as { attribution?: string };
    expect(src.attribution).toMatch(/ODbL/);
    expect(src.attribution).toMatch(/CARTO/);
  });

  it("attribution lists sources actually on screen", () => {
    expect(
      mapAttribution("streets", { labelsOn: true, satellite: false }),
    ).toMatch(/OpenStreetMap/);
    expect(
      mapAttribution("offline", { labelsOn: true, satellite: true }),
    ).toMatch(/Esri/);
    expect(
      mapAttribution("offline", { labelsOn: true, satellite: true }),
    ).toMatch(/CARTO labels/);
    expect(
      mapAttribution("offline", { labelsOn: false, satellite: true }),
    ).not.toMatch(/CARTO/);
  });
});
