/**
 * Geometric radio horizon from DEM (k=4/3 Earth).
 * NOT measured RF / not a propagation forecast — LOS geometry only.
 */
import { destinationPoint } from "@/utils/geo";
import { getTerrainAdapter } from "./terrainEngine";

export interface HorizonSample {
  bearingDeg: number;
  distanceM: number;
  lat: number;
  lng: number;
  blockedByTerrain: boolean;
  missingDem: boolean;
}

export interface HorizonResult {
  points: HorizonSample[];
  antennaAmslM: number | null;
  geometricMaxM: number;
  /** Explicit operator-facing disclaimer. */
  disclaimer: string;
}

const R_RADIO_M = 6_371_000 * (4 / 3);

/** Optical/radio geometric horizon distance for height above surrounding (m). */
export function geometricHorizonM(heightAglM: number): number {
  const h = Math.max(0, heightAglM);
  return Math.sqrt(2 * R_RADIO_M * h);
}

/**
 * Sample DEM along rays; stop when terrain intersects 0°-elevation LOS
 * (with Earth curvature under k=4/3).
 */
export async function computeRadioHorizon(opts: {
  lat: number;
  lng: number;
  /** Antenna center AMSL (m). If null — horizon cannot use DEM blockage. */
  antennaAmslM: number | null;
  /** Height above local ground used for geometric cap (m). */
  heightAglM: number;
  /** Operator range limit (m). */
  rangeLimitM: number;
  bearingStepDeg?: number;
  stepM?: number;
}): Promise<HorizonResult> {
  const {
    lat,
    lng,
    antennaAmslM,
    heightAglM,
    rangeLimitM,
    bearingStepDeg = 5,
    stepM = 400,
  } = opts;
  const geometricMaxM = geometricHorizonM(heightAglM);
  const maxM = Math.min(Math.max(500, rangeLimitM), Math.max(geometricMaxM, 1000));
  const adapter = getTerrainAdapter();
  const points: HorizonSample[] = [];

  for (let brg = 0; brg < 360; brg += bearingStepDeg) {
    let hitM = maxM;
    let blocked = false;
    let missing = false;
    if (antennaAmslM != null) {
      for (let d = stepM; d <= maxM; d += stepM) {
        const p = destinationPoint(lat, lng, brg, d);
        const s = await adapter.sample(p.lat, p.lng);
        if (s.missing || s.elevationM == null) {
          missing = true;
          continue;
        }
        const curve = (d * d) / (2 * R_RADIO_M);
        const rayAmsl = antennaAmslM - curve;
        // Clearance 0: terrain blocks if surface ≥ ray
        if (s.elevationM >= rayAmsl) {
          hitM = d;
          blocked = true;
          break;
        }
      }
    }
    const end = destinationPoint(lat, lng, brg, hitM);
    points.push({
      bearingDeg: brg,
      distanceM: hitM,
      lat: end.lat,
      lng: end.lng,
      blockedByTerrain: blocked,
      missingDem: missing && !blocked,
    });
  }

  return {
    points,
    antennaAmslM,
    geometricMaxM,
    disclaimer:
      "Геометрический радиогоризонт (k=4/3, DEM) · не измеренный RF и не прогноз канала",
  };
}
