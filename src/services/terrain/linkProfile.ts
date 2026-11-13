/**
 * Terrain profile + LOS + first Fresnel along station → target.
 * Not a propagation forecast.
 */
import { destinationPoint, haversineM } from "@/utils/geo";
import { getTerrainAdapter } from "./terrainEngine";
import {
  fresnelRadiusM,
  type RadioVisibilityStatus,
} from "./fresnel";

const R_RADIO_M = 6_371_000 * (4 / 3);

export interface LinkProfilePoint {
  distanceM: number;
  lat: number;
  lng: number;
  terrainM: number | null;
  missing: boolean;
  /** Straight LOS ray AMSL (Earth curvature k=4/3). */
  losAmslM: number | null;
  fresnelRadiusM: number | null;
  /** terrain above (los - F1) → intrusion into first Fresnel. */
  fresnelIntrusionM: number | null;
  blocksLos: boolean;
}

export interface LinkProfileResult {
  points: LinkProfilePoint[];
  distanceM: number;
  status: RadioVisibilityStatus;
  maxObstacleM: number | null;
  maxObstacleAtM: number | null;
  deltaHeightM: number | null;
  azimuthDeg: number;
  elevationDeg: number;
  disclaimer: string;
}

export async function computeLinkProfile(opts: {
  stationLat: number;
  stationLng: number;
  stationAntennaAmslM: number | null;
  targetLat: number;
  targetLng: number;
  targetAmslM: number | null;
  freqGhz: number;
  steps?: number;
}): Promise<LinkProfileResult> {
  const {
    stationLat,
    stationLng,
    stationAntennaAmslM,
    targetLat,
    targetLng,
    targetAmslM,
    freqGhz,
    steps = 48,
  } = opts;

  const distanceM = haversineM(
    { lat: stationLat, lng: stationLng },
    { lat: targetLat, lng: targetLng },
  );
  const Dkm = Math.max(distanceM / 1000, 1e-6);

  // Bearing
  const φ1 = (stationLat * Math.PI) / 180;
  const φ2 = (targetLat * Math.PI) / 180;
  const Δλ = ((targetLng - stationLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const azimuthDeg = (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;

  let elevationDeg = 0;
  if (stationAntennaAmslM != null && targetAmslM != null && distanceM > 1) {
    const curve = (distanceM * distanceM) / (2 * R_RADIO_M);
    elevationDeg =
      (Math.atan2(targetAmslM - stationAntennaAmslM - curve, distanceM) *
        180) /
      Math.PI;
  }

  const adapter = getTerrainAdapter();
  const points: LinkProfilePoint[] = [];
  let status: RadioVisibilityStatus = "unknown";
  let maxObstacleM: number | null = null;
  let maxObstacleAtM: number | null = null;
  let anyMissing = false;
  let blocked = false;
  let partial = false;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const d = t * distanceM;
    const p = destinationPoint(stationLat, stationLng, azimuthDeg, d);
    const s = await adapter.sample(p.lat, p.lng);
    const missing = s.missing || s.elevationM == null;
    if (missing) anyMissing = true;

    let losAmsl: number | null = null;
    let f1: number | null = null;
    let intrusion: number | null = null;
    let blocksLos = false;

    if (stationAntennaAmslM != null && targetAmslM != null) {
      const curve = (d * d) / (2 * R_RADIO_M);
      losAmsl =
        stationAntennaAmslM +
        t * (targetAmslM - stationAntennaAmslM) -
        curve;
      const d1 = d / 1000;
      const d2 = (distanceM - d) / 1000;
      f1 = fresnelRadiusM(d1, d2, Dkm, freqGhz);
      if (!missing && s.elevationM != null) {
        const clearToLos = losAmsl - s.elevationM;
        blocksLos = clearToLos <= 0;
        intrusion = s.elevationM - (losAmsl - f1);
        if (blocksLos) {
          blocked = true;
          if (maxObstacleM == null || s.elevationM > maxObstacleM) {
            maxObstacleM = s.elevationM;
            maxObstacleAtM = d;
          }
        } else if (intrusion > 0) {
          partial = true;
          if (maxObstacleM == null || s.elevationM > maxObstacleM) {
            maxObstacleM = s.elevationM;
            maxObstacleAtM = d;
          }
        }
      }
    }

    points.push({
      distanceM: d,
      lat: p.lat,
      lng: p.lng,
      terrainM: missing ? null : s.elevationM!,
      missing,
      losAmslM: losAmsl,
      fresnelRadiusM: f1,
      fresnelIntrusionM: intrusion,
      blocksLos,
    });
  }

  if (stationAntennaAmslM == null || targetAmslM == null || anyMissing) {
    status = blocked ? "blocked" : "unknown";
  } else if (blocked) status = "blocked";
  else if (partial) status = "fresnel_partial";
  else status = "clear";

  const deltaHeightM =
    stationAntennaAmslM != null && targetAmslM != null
      ? targetAmslM - stationAntennaAmslM
      : null;

  return {
    points,
    distanceM,
    status,
    maxObstacleM,
    maxObstacleAtM,
    deltaHeightM,
    azimuthDeg,
    elevationDeg,
    disclaimer:
      "Геометрия DEM + 1-я зона Френеля · не прогноз радиоканала / не измеренный RF",
  };
}
