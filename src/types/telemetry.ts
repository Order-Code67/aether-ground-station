/**
 * JSON-протокол диагностической телеметрии.
 * Отсутствующие датчики — null, не вымышленные числа (в том числе не 0).
 */

export interface DiagnosticsMessage {
  device: string;
  version: string;
  status: string;
  voltage: number | null;
  temperature: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitudeM?: number | null;
  [key: string]: unknown;
}

/** Finite number only — NaN / Inf / missing → null. Zero is kept (valid reading). */
export function honestNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Uninitialized GPS stacks often emit 0,0 — that is not a fix.
 * Do not treat it as a position.
 */
export function honestLatLng(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | null {
  const la = honestNumber(lat);
  const lo = honestNumber(lng);
  if (la == null || lo == null) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  if (la === 0 && lo === 0) return null;
  return { lat: la, lng: lo };
}

export function parseDiagnosticsMessage(raw: string): DiagnosticsMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.device !== "string") return null;
    if (typeof obj.version !== "string") return null;
    if (typeof obj.status !== "string") return null;
    const pos = honestLatLng(
      obj.lat ?? obj.latitude,
      obj.lon ?? obj.lng ?? obj.longitude,
    );
    return {
      ...obj,
      device: obj.device,
      version: obj.version,
      status: obj.status,
      voltage: honestNumber(obj.voltage ?? obj.voltageV),
      temperature: honestNumber(obj.temperature ?? obj.temperatureC),
      latitude: pos?.lat ?? null,
      longitude: pos?.lng ?? null,
      altitudeM: honestNumber(obj.alt ?? obj.altitudeM ?? obj.altitude),
    };
  } catch {
    return null;
  }
}
