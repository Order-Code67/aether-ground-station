/**
 * Parse local pan-tilt angle telemetry lines.
 * Returns null when the line does not contain both AZ and EL — never invents.
 */

export interface ParsedPanTiltAngles {
  azimuthDeg: number;
  elevationDeg: number;
}

/** Accept common local firmware / logger formats. */
export function parsePanTiltAngles(raw: string): ParsedPanTiltAngles | null {
  const line = raw.trim();
  if (!line) return null;

  // JSON: {"az":1.2,"el":3.4} or azimuth/elevation keys
  if (line.startsWith("{")) {
    try {
      const j = JSON.parse(line) as Record<string, unknown>;
      const az = num(j.az ?? j.azimuth ?? j.azimuthDeg ?? j.AZ);
      const el = num(j.el ?? j.elevation ?? j.elevationDeg ?? j.EL);
      if (az != null && el != null) return { azimuthDeg: az, elevationDeg: el };
    } catch {
      /* fall through */
    }
  }

  const az =
    matchNum(line, /\b(?:az|azimuth|azi)\s*[:=]\s*([+-]?\d+(?:\.\d+)?)/i) ??
    matchNum(line, /\bA\s*[:=]\s*([+-]?\d+(?:\.\d+)?)/);
  const el =
    matchNum(line, /\b(?:el|elev|elevation|alt)\s*[:=]\s*([+-]?\d+(?:\.\d+)?)/i) ??
    matchNum(line, /\bE\s*[:=]\s*([+-]?\d+(?:\.\d+)?)/);

  if (az != null && el != null) return { azimuthDeg: az, elevationDeg: el };

  // Plain "12.3,4.5" or "12.3 4.5"
  const pair = line.match(
    /^([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/,
  );
  if (pair) {
    const a = Number(pair[1]);
    const e = Number(pair[2]);
    if (Number.isFinite(a) && Number.isFinite(e)) {
      return { azimuthDeg: a, elevationDeg: e };
    }
  }

  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function matchNum(line: string, re: RegExp): number | null {
  const m = line.match(re);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
