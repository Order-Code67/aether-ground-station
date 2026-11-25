import { honestLatLng, honestNumber } from "@/types";

export type CoordParseOk = { ok: true; lat: number; lng: number };
export type CoordParseErr = { ok: false; error: string };
export type CoordParseResult = CoordParseOk | CoordParseErr;

function normalizeDecimal(raw: string): string {
  return raw.trim().replace(/\s+/g, "").replace(",", ".");
}

/** Parse operator lat/lon. Empty, garbage, and GPS 0,0 → error (never silent origin). */
export function parseLatLonInput(
  latRaw: string,
  lngRaw: string,
): CoordParseResult {
  let latS = latRaw.trim();
  let lngS = lngRaw.trim();

  if (!lngS && latS) {
    const pair = latS.match(
      /^([+-]?\d+(?:[.,]\d+)?)\s*[,;\s]\s*([+-]?\d+(?:[.,]\d+)?)$/,
    );
    if (pair) {
      const trialLng = Number(normalizeDecimal(pair[2]!));
      // "54,782" is a European decimal, not lat=54 lon=782.
      if (Number.isFinite(trialLng) && Math.abs(trialLng) <= 180) {
        latS = pair[1]!;
        lngS = pair[2]!;
      }
    }
  }

  if (!latS || !lngS) {
    return { ok: false, error: "Введите широту и долготу" };
  }

  const latN = normalizeDecimal(latS);
  const lngN = normalizeDecimal(lngS);
  if (!/^[+-]?\d+(\.\d+)?$/.test(latN) || !/^[+-]?\d+(\.\d+)?$/.test(lngN)) {
    return { ok: false, error: "Координаты не распознаны" };
  }

  const lat = honestNumber(latN);
  const lng = honestNumber(lngN);
  if (lat == null || lng == null) {
    return { ok: false, error: "Координаты не распознаны" };
  }
  if (lat === 0 && lng === 0) {
    return {
      ok: false,
      error: "GPS 0,0 не считается валидной станцией / точкой",
    };
  }
  const pos = honestLatLng(lat, lng);
  if (!pos) {
    return {
      ok: false,
      error: "Широта −90…90, долгота −180…180",
    };
  }
  return { ok: true, lat: pos.lat, lng: pos.lng };
}

export function requirePlannerFix(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const parsed = parseLatLonInput(String(lat), String(lng));
  if (!parsed.ok) throw new Error(parsed.error);
  return { lat: parsed.lat, lng: parsed.lng };
}

/** Site coords if they are a real fix (not missing / 0,0). */
export function siteLatLng(site: {
  latitude?: number | null;
  longitude?: number | null;
} | null | undefined): { lat: number; lng: number } | null {
  if (!site) return null;
  return honestLatLng(site.latitude, site.longitude);
}
