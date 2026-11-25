/** Import operator GeoJSON / simple KML as planning GIS objects (not aircraft routes). */

export type ImportedGis = {
  points: { lat: number; lng: number; name: string }[];
  lines: { name: string; points: { lat: number; lng: number }[] }[];
  message: string;
};

function asCoord(pair: unknown): { lng: number; lat: number } | null {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lng = Number(pair[0]);
  const lat = Number(pair[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function walkGeometry(
  geom: { type?: string; coordinates?: unknown; geometries?: unknown },
  name: string,
  out: ImportedGis,
): void {
  const t = geom.type;
  const coords = geom.coordinates;
  if (t === "Point") {
    const c = asCoord(coords);
    if (c) out.points.push({ ...c, name });
    return;
  }
  if (t === "MultiPoint" && Array.isArray(coords)) {
    for (const p of coords) {
      const c = asCoord(p);
      if (c) out.points.push({ ...c, name });
    }
    return;
  }
  if ((t === "LineString" || t === "MultiLineString") && Array.isArray(coords)) {
    const rings = t === "LineString" ? [coords] : coords;
    for (const line of rings) {
      if (!Array.isArray(line)) continue;
      const pts = line
        .map(asCoord)
        .filter((p): p is { lat: number; lng: number } => p != null);
      if (pts.length >= 2) out.lines.push({ name, points: pts });
    }
    return;
  }
  if ((t === "Polygon" || t === "MultiPolygon") && Array.isArray(coords)) {
    const first = t === "Polygon" ? coords[0] : (coords[0] as unknown[])?.[0];
    if (Array.isArray(first)) {
      const pts = first
        .map(asCoord)
        .filter((p): p is { lat: number; lng: number } => p != null);
      if (pts.length >= 2) out.lines.push({ name: `${name} (контур)`, points: pts });
    }
    return;
  }
  if (t === "GeometryCollection" && Array.isArray(geom.geometries)) {
    for (const g of geom.geometries) {
      if (g && typeof g === "object") {
        walkGeometry(g as { type?: string; coordinates?: unknown }, name, out);
      }
    }
  }
}

export function parseGeoJson(text: string): ImportedGis {
  const out: ImportedGis = { points: [], lines: [], message: "" };
  const json = JSON.parse(text) as {
    type?: string;
    features?: unknown[];
    geometry?: { type?: string; coordinates?: unknown };
    properties?: { name?: string };
    coordinates?: unknown;
  };
  const features =
    json.type === "FeatureCollection" && Array.isArray(json.features)
      ? json.features
      : json.type === "Feature"
        ? [json]
        : json.type
          ? [{ type: "Feature", geometry: json, properties: {} }]
          : [];
  for (const raw of features) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as {
      geometry?: { type?: string; coordinates?: unknown; geometries?: unknown };
      properties?: { name?: string; Name?: string };
    };
    if (!f.geometry) continue;
    const name = f.properties?.name || f.properties?.Name || "импорт";
    walkGeometry(f.geometry, name, out);
  }
  out.message = `GeoJSON: точек ${out.points.length}, линий ${out.lines.length}`;
  return out;
}

export function parseKmlPlacemarks(text: string): ImportedGis {
  const out: ImportedGis = { points: [], lines: [], message: "" };
  const re = /<Placemark\b[\s\S]*?<\/Placemark>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const block = m[0]!;
    const nameRaw = /<name>([\s\S]*?)<\/name>/i.exec(block)?.[1];
    const name = (nameRaw ?? "KML").replace(/<[^>]+>/g, "").trim() || "KML";
    const coord = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(block)?.[1];
    if (!coord) continue;
    const pairs = coord.trim().split(/\s+/);
    const pts: { lat: number; lng: number }[] = [];
    for (const p of pairs) {
      const [lngS, latS] = p.split(",");
      const lng = Number(lngS);
      const lat = Number(latS);
      if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
    }
    if (pts.length === 1) out.points.push({ ...pts[0]!, name });
    else if (pts.length >= 2) out.lines.push({ name, points: pts });
  }
  out.message = `KML: точек ${out.points.length}, линий ${out.lines.length}`;
  return out;
}

export function parseGisFile(name: string, text: string): ImportedGis {
  const lower = name.toLowerCase();
  if (lower.endsWith(".kml") || text.includes("<kml")) {
    return parseKmlPlacemarks(text);
  }
  return parseGeoJson(text);
}
