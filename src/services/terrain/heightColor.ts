/** Shared elevation → color mapping for 2D colormap and 3D mesh. */

export interface HeightStop {
  maxM: number;
  color: string;
  rgb: [number, number, number];
}

/** Absolute bands (m AMSL) — matches HeightLegend. */
export const HEIGHT_STOPS: HeightStop[] = [
  { maxM: 50, color: "#1a5c3a", rgb: [26, 92, 58] },
  { maxM: 150, color: "#3d9b4a", rgb: [61, 155, 74] },
  { maxM: 250, color: "#d4c03a", rgb: [212, 192, 58] },
  { maxM: 300, color: "#d4782a", rgb: [212, 120, 42] },
  { maxM: Infinity, color: "#c03030", rgb: [192, 48, 48] },
];

export function elevToRgb(
  elevM: number,
  minE?: number,
  maxE?: number,
): [number, number, number] {
  let e = elevM;
  if (minE != null && maxE != null && maxE - minE < 5) {
    e = minE + ((elevM - minE) / (maxE - minE || 1)) * 320;
  }
  for (const s of HEIGHT_STOPS) {
    if (e < s.maxM) return s.rgb;
  }
  return HEIGHT_STOPS[HEIGHT_STOPS.length - 1]!.rgb;
}

export function elevToCss(elevM: number): string {
  const [r, g, b] = elevToRgb(elevM);
  return `rgb(${r},${g},${b})`;
}
