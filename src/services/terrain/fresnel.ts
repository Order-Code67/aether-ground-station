/**
 * First Fresnel zone radius (m).
 * F1 = 17.32 × √(d1 × d2 / (f × D))
 * d1,d2,D in km; f in GHz.
 * Geometry only — not a link-quality guarantee.
 */
export function fresnelRadiusM(
  d1Km: number,
  d2Km: number,
  totalKm: number,
  freqGhz: number,
): number {
  const D = Math.max(totalKm, 1e-6);
  const f = Math.max(freqGhz, 1e-6);
  const d1 = Math.max(d1Km, 0);
  const d2 = Math.max(d2Km, 0);
  return 17.32 * Math.sqrt((d1 * d2) / (f * D));
}

export type RadioVisibilityStatus =
  | "clear"
  | "fresnel_partial"
  | "blocked"
  | "unknown";

export function radioVisibilityLabel(s: RadioVisibilityStatus): string {
  switch (s) {
    case "clear":
      return "Прямая видимость";
    case "fresnel_partial":
      return "Частичное перекрытие зоны Френеля";
    case "blocked":
      return "Препятствие на линии видимости";
    case "unknown":
      return "Недостаточно данных";
  }
}

export function radioVisibilityTone(
  s: RadioVisibilityStatus,
): "ok" | "warn" | "danger" | "muted" {
  switch (s) {
    case "clear":
      return "ok";
    case "fresnel_partial":
      return "warn";
    case "blocked":
      return "danger";
    default:
      return "muted";
  }
}

/**
 * Clearance vs first Fresnel: terrain AMSL vs LOS ray AMSL ± F1.
 * clearanceM = (rayAmsl - F1) - terrainAmsl  (positive = clear of F1).
 */
/** clearanceToFresnelM = (losAmsl − F1) − terrain; &lt;0 means inside/above first zone floor. */
export function classifyFresnelClearance(
  clearanceToFresnelM: number | null,
  losBlocked: boolean,
): RadioVisibilityStatus {
  if (clearanceToFresnelM == null) return "unknown";
  if (losBlocked || clearanceToFresnelM < 0) return "blocked";
  if (clearanceToFresnelM < 5) return "fresnel_partial";
  return "clear";
}
