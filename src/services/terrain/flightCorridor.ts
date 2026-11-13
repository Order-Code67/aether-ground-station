/**
 * Flight corridor clearance along a heading using DEM (geometry only, not RF).
 */
import { destinationPoint } from "@/utils/geo";
import { getTerrainAdapter } from "./terrainEngine";

const R_RADIO_M = 6_371_000 * (4 / 3);

export type CorridorClearance = "clear" | "tight" | "blocked" | "unknown";

export interface CorridorSample {
  distanceM: number;
  lat: number;
  lng: number;
  terrainM: number | null;
  /** Antenna ray AMSL after curvature (m). */
  rayAmslM: number | null;
  clearanceM: number | null;
  status: CorridorClearance;
}

export interface CorridorResult {
  samples: CorridorSample[];
  clearToM: number;
  antennaAmslM: number | null;
}

/**
 * Sample DEM along bearing; status by clearance under 0° LOS from antenna AMSL.
 * tight = clearance &lt; 30 m; blocked = terrain ≥ ray.
 */
export async function computeFlightCorridor(opts: {
  lat: number;
  lng: number;
  bearingDeg: number;
  antennaAmslM: number | null;
  rangeLimitM: number;
  stepM?: number;
  tightClearanceM?: number;
}): Promise<CorridorResult> {
  const {
    lat,
    lng,
    bearingDeg,
    antennaAmslM,
    rangeLimitM,
    stepM = 250,
    tightClearanceM = 30,
  } = opts;
  const maxM = Math.max(500, rangeLimitM);
  const adapter = getTerrainAdapter();
  const samples: CorridorSample[] = [];
  let clearToM = maxM;

  for (let d = stepM; d <= maxM; d += stepM) {
    const p = destinationPoint(lat, lng, bearingDeg, d);
    if (antennaAmslM == null) {
      samples.push({
        distanceM: d,
        lat: p.lat,
        lng: p.lng,
        terrainM: null,
        rayAmslM: null,
        clearanceM: null,
        status: "unknown",
      });
      continue;
    }
    const s = await adapter.sample(p.lat, p.lng);
    const curve = (d * d) / (2 * R_RADIO_M);
    const rayAmsl = antennaAmslM - curve;
    if (s.missing || s.elevationM == null) {
      samples.push({
        distanceM: d,
        lat: p.lat,
        lng: p.lng,
        terrainM: null,
        rayAmslM: rayAmsl,
        clearanceM: null,
        status: "unknown",
      });
      continue;
    }
    const clearance = rayAmsl - s.elevationM;
    let status: CorridorClearance = "clear";
    if (clearance <= 0) {
      status = "blocked";
      clearToM = Math.min(clearToM, d);
    } else if (clearance < tightClearanceM) {
      status = "tight";
    }
    samples.push({
      distanceM: d,
      lat: p.lat,
      lng: p.lng,
      terrainM: s.elevationM,
      rayAmslM: rayAmsl,
      clearanceM: clearance,
      status,
    });
  }

  if (samples.some((s) => s.status === "blocked")) {
    const first = samples.find((s) => s.status === "blocked");
    clearToM = first?.distanceM ?? clearToM;
  } else {
    clearToM = maxM;
  }

  return { samples, clearToM, antennaAmslM };
}

/** Build SVG path for a horizontal sector (center bearing ± halfWidth). */
export function sectorPolygon(
  lat: number,
  lng: number,
  centerBearingDeg: number,
  halfWidthDeg: number,
  radiusM: number,
  project: (lon: number, lat: number) => { x: number; y: number },
  steps = 24,
): string {
  const a = project(lng, lat);
  const pts: string[] = [`M${a.x.toFixed(1)},${a.y.toFixed(1)}`];
  const start = centerBearingDeg - halfWidthDeg;
  for (let i = 0; i <= steps; i++) {
    const brg = start + (i / steps) * (halfWidthDeg * 2);
    const p = destinationPoint(lat, lng, brg, radiusM);
    const s = project(p.lng, p.lat);
    pts.push(`L${s.x.toFixed(1)},${s.y.toFixed(1)}`);
  }
  pts.push("Z");
  return pts.join(" ");
}
