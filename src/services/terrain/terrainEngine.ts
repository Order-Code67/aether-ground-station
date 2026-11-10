/**
 * Terrain Engine (V2) — DEM adapters.
 * Without a loaded DEM, heights are explicitly unavailable (N/A), never invented.
 */

export interface TerrainSample {
  latitude: number;
  longitude: number;
  elevationM: number | null;
  sourceId: string | null;
  missing: boolean;
}

export interface TerrainProfilePoint {
  distanceM: number;
  surfaceElevationM: number | null;
  antennaCenterAmslM: number | null;
  missing: boolean;
}

export interface DemSourceMeta {
  id: string;
  name: string;
  sourceType: "geotiff" | "srtm" | "copernicus" | "aster" | "custom" | "none";
  path?: string;
  resolutionM?: number;
  verticalDatum?: string;
  uncertaintyM?: number;
}

export interface TerrainAdapter {
  id: string;
  label: string;
  sample(lat: number, lng: number): Promise<TerrainSample>;
}

/** Default adapter: no DEM loaded. */
export const emptyTerrainAdapter: TerrainAdapter = {
  id: "none",
  label: "Нет DEM",
  async sample(lat, lng) {
    return {
      latitude: lat,
      longitude: lng,
      elevationM: null,
      sourceId: null,
      missing: true,
    };
  },
};

/**
 * Synthetic grid only for Simulation / unit tests — never presented as measured DEM.
 * Production path uses GeoTIFF adapter when file is loaded.
 */
export function buildLinearProfile(opts: {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  steps: number;
  antennaCenterAmslM: number | null;
  sample: (lat: number, lng: number) => Promise<TerrainSample>;
}): Promise<TerrainProfilePoint[]> {
  const { startLat, startLng, endLat, endLng, steps, antennaCenterAmslM, sample } = opts;
  const n = Math.max(2, steps);
  const approxDistM = haversineM(startLat, startLng, endLat, endLng);
  return Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const t = i / (n - 1);
      const lat = startLat + (endLat - startLat) * t;
      const lng = startLng + (endLng - startLng) * t;
      const s = await sample(lat, lng);
      return {
        distanceM: approxDistM * t,
        surfaceElevationM: s.elevationM,
        antennaCenterAmslM,
        missing: s.missing,
      };
    }),
  );
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

let active: TerrainAdapter = emptyTerrainAdapter;
let meta: DemSourceMeta = { id: "none", name: "Нет данных", sourceType: "none" };

export function getTerrainAdapter(): TerrainAdapter {
  return active;
}

export function getDemMeta(): DemSourceMeta {
  return meta;
}

export function setTerrainAdapter(adapter: TerrainAdapter, source: DemSourceMeta): void {
  active = adapter;
  meta = source;
}

/** Manual elevation entry adapter (operator-provided), clearly labeled. */
export function createManualElevationAdapter(
  points: Map<string, number>,
): TerrainAdapter {
  return {
    id: "manual",
    label: "Ручные отметки",
    async sample(lat, lng) {
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const elevationM = points.get(key) ?? null;
      return {
        latitude: lat,
        longitude: lng,
        elevationM,
        sourceId: "manual",
        missing: elevationM == null,
      };
    },
  };
}

/** GeoTIFF DEM via Rust sampler (uncompressed Float32/Int16 + geo tags). */
export function createGeoTiffAdapter(path: string): TerrainAdapter {
  return {
    id: "geotiff",
    label: `GeoTIFF ${path}`,
    async sample(lat, lng) {
      const { invoke } = await import("@tauri-apps/api/core");
      const { isTauriRuntime } = await import("@/services/tauri");
      if (!isTauriRuntime()) {
        return {
          latitude: lat,
          longitude: lng,
          elevationM: null,
          sourceId: null,
          missing: true,
        };
      }
      const s = await invoke<{
        elevationM?: number | null;
        missing: boolean;
        message: string;
      }>("terrain_sample_elevation", {
        path,
        latitude: lat,
        longitude: lng,
      });
      return {
        latitude: lat,
        longitude: lng,
        elevationM: s.elevationM ?? null,
        sourceId: "geotiff",
        missing: s.missing || s.elevationM == null,
      };
    },
  };
}
