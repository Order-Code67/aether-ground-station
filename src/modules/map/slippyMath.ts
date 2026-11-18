/** Web-Mercator helpers for offline XYZ slippy map (no MapLibre worker). */

export function lon2tile(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

export function lat2tile(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
}

export function tile2lon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function lonLatToWorldPx(
  lon: number,
  lat: number,
  z: number,
  tileSize = 256,
): { x: number; y: number } {
  const scale = tileSize * 2 ** z;
  const x = ((lon + 180) / 360) * scale;
  const r = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * scale;
  return { x, y };
}

export function worldPxToLonLat(
  x: number,
  y: number,
  z: number,
  tileSize = 256,
): { lon: number; lat: number } {
  const scale = tileSize * 2 ** z;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lon, lat };
}

export function destinationByAzimuth(
  lon: number,
  lat: number,
  azDeg: number,
  lenDeg: number,
): { lon: number; lat: number } {
  const az = (azDeg * Math.PI) / 180;
  return {
    lon: lon + Math.sin(az) * lenDeg,
    lat: lat + Math.cos(az) * lenDeg,
  };
}
