import type { StyleSpecification } from "maplibre-gl";

/** Absolute same-origin URL (required for Tauri asset / custom protocol). */
export function absoluteAssetUrl(pathOrTemplate: string): string {
  const raw = pathOrTemplate.trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:")) return raw;
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${origin}${path}`;
}

/** Bundled offline dark tiles (public/tiles) — Esri World Dark Gray, no network. */
export const BUNDLED_OFFLINE_TILES = "/tiles/{z}/{x}/{y}.jpg";

/** Bundled Terrarium DEM (public/dem-tiles) for MapLibre 3D terrain. */
export const BUNDLED_DEM_TILES = "/dem-tiles/{z}/{x}/{y}.png";
export const BUNDLED_DEM_MAX_ZOOM = 11;

/** Default map center — Смоленск (областной центр). */
export const DEFAULT_MAP_CENTER: [number, number] = [32.045, 54.782];
export const DEFAULT_MAP_ZOOM = 9;

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
  const template = absoluteAssetUrl(
    (localTileUrlTemplate ?? BUNDLED_OFFLINE_TILES).trim(),
  );
  if (template) {
    return {
      version: 8,
      sources: {
        local: {
          type: "raster",
          tiles: [template],
          tileSize: 256,
          attribution: "Aether offline · Esri Dark Gray · Центральная Россия",
          maxzoom: 12,
          scheme: "xyz",
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
