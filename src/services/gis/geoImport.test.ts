import { describe, expect, it } from "vitest";
import { parseGeoJson, parseGisFile, parseKmlPlacemarks } from "./geoImport";

describe("geoImport", () => {
  it("imports GeoJSON points and lines", () => {
    const g = parseGeoJson(
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "A" },
            geometry: { type: "Point", coordinates: [32.04, 54.78] },
          },
          {
            type: "Feature",
            properties: { name: "R" },
            geometry: {
              type: "LineString",
              coordinates: [
                [32.0, 54.7],
                [32.1, 54.8],
              ],
            },
          },
        ],
      }),
    );
    expect(g.points).toHaveLength(1);
    expect(g.points[0]?.lat).toBeCloseTo(54.78);
    expect(g.lines).toHaveLength(1);
    expect(g.lines[0]?.points).toHaveLength(2);
  });

  it("imports KML placemark", () => {
    const k = parseKmlPlacemarks(
      `<kml><Placemark><name>P</name><Point><coordinates>32.1,54.7,0</coordinates></Point></Placemark></kml>`,
    );
    expect(k.points).toHaveLength(1);
    expect(k.points[0]?.name).toBe("P");
  });

  it("rejects junk coordinates", () => {
    const g = parseGisFile(
      "x.geojson",
      JSON.stringify({
        type: "Feature",
        geometry: { type: "Point", coordinates: [999, 54] },
      }),
    );
    expect(g.points).toHaveLength(0);
  });
});
