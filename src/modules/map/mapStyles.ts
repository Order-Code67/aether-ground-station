import type { StyleSpecification } from "maplibre-gl";

/** Bundled offline dark tiles (public/tiles) — no network required. */
export const BUNDLED_OFFLINE_TILES = "/tiles/{z}/{x}/{y}.png";

/** Online OSM raster — requires network. */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [
    {
      id: "bg",
      type: "background",
      paint: { "background-color": "#0b1018" },
    },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

/**
 * Offline / local XYZ. Default template = bundled dark tiles under /tiles.
 * Markers / measure / azimuth work even if some zooms are missing.
 */
export function offlineStyle(
  localTileUrlTemplate?: string,
): StyleSpecification {
  const template = (localTileUrlTemplate ?? BUNDLED_OFFLINE_TILES).trim();
  if (template) {
    return {
      version: 8,
      sources: {
        local: {
          type: "raster",
          tiles: [template],
          tileSize: 256,
          attribution: "Aether offline tiles",
          maxzoom: 12,
        },
      },
      layers: [
        {
          id: "bg",
          type: "background",
          paint: { "background-color": "#0b1018" },
        },
        { id: "local", type: "raster", source: "local" },
      ],
    };
  }
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "bg",
        type: "background",
        paint: { "background-color": "#0b1018" },
      },
    ],
  };
}
