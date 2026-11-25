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

/** Bundled offline satellite tiles (public/tiles) — Esri World Imagery. */
export const BUNDLED_OFFLINE_TILES = "/tiles/{z}/{x}/{y}.jpg";

/** Bundled place/boundary labels (public/tiles-labels). */
export const BUNDLED_LABEL_TILES = "/tiles-labels/{z}/{x}/{y}.png";

/** Bundled Terrarium DEM (public/dem-tiles) for relief / hillshade overlay. */
export const BUNDLED_DEM_TILES = "/dem-tiles/{z}/{x}/{y}.png";
export const BUNDLED_DEM_MIN_ZOOM = 5;
export const BUNDLED_DEM_MAX_ZOOM = 11;

/** Default map center — Смоленск (областной центр). */
export const DEFAULT_MAP_CENTER: [number, number] = [32.045, 54.782];
export const DEFAULT_MAP_ZOOM = 9;

/**
 * OSM Carto (raster) — улицы и подписи при z≥14. Данные OSM, лицензия ODbL.
 * Политика OSMF: справедливое использование, не кэш всего мира в репозиторий.
 */
export const OSM_CARTO_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * CARTO Dark Matter — тёмная растровая база по данным OSM (ODbL).
 * Улицы, названия, кварталы, POI. Без ключа Mapbox/Google.
 * https://carto.com/basemaps
 */
export const CARTO_DARK_ALL_TILES =
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";

/** Только подписи CARTO Dark (прозрачный слой поверх спутника / DEM). */
export const CARTO_DARK_LABELS_TILES =
  "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png";

export const OSM_STREETS_MAX_ZOOM = 18;
export const BUNDLED_BASE_MAX_ZOOM = 12;

export const MAP_ATTR_OSM = "© OpenStreetMap contributors (ODbL)";
export const MAP_ATTR_CARTO = "© CARTO";
export const MAP_ATTR_ESRI = "Esri World Imagery (офлайн)";

export type MapTileMode = "offline" | "local" | "osm" | "streets";

export function mapAttribution(
  mode: MapTileMode,
  opts: { labelsOn: boolean; satellite: boolean },
): string {
  const parts: string[] = [];
  if (mode === "offline" || mode === "local") {
    if (opts.satellite) parts.push(MAP_ATTR_ESRI);
    if (opts.labelsOn) {
      parts.push(MAP_ATTR_OSM, `${MAP_ATTR_CARTO} labels`);
    }
  } else if (mode === "osm") {
    parts.push(MAP_ATTR_OSM);
  } else if (mode === "streets") {
    parts.push(MAP_ATTR_OSM, MAP_ATTR_CARTO);
  }
  return parts.join(" · ");
}

/** Online OSM raster — requires network. */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [OSM_CARTO_TILES],
      tileSize: 256,
      attribution: MAP_ATTR_OSM,
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

export const CARTO_DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [CARTO_DARK_ALL_TILES],
      tileSize: 256,
      attribution: `${MAP_ATTR_OSM} · ${MAP_ATTR_CARTO}`,
      maxzoom: OSM_STREETS_MAX_ZOOM,
    },
  },
  layers: [
    {
      id: "bg",
      type: "background",
      paint: { "background-color": "#0b1018" },
    },
    { id: "carto", type: "raster", source: "carto" },
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
          attribution: "Aether offline · Esri World Imagery · Центральная Россия",
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
