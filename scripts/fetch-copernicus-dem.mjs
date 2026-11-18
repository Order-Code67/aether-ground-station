/**
 * Download free Copernicus DEM GLO-90 COG tiles (AWS Open Data) for Smolensk
 * + Moscow/Central Russia sample cells.
 *
 * Source (no auth):
 * https://copernicus-dem-90m.s3.amazonaws.com/
 *   Copernicus_DSM_COG_30_N{lat}_00_E{lon}_00_DEM/
 *   Copernicus_DSM_COG_30_N{lat}_00_E{lon}_00_DEM.tif
 *
 * Usage: node scripts/fetch-copernicus-dem.mjs
 */
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "vendor", "dem-copernicus");

/** 1°×1° cells covering Smolensk Oblast + adjacent Central Russia. */
const CELLS = [];
for (let lat = 53; lat <= 56; lat++) {
  for (let lon = 30; lon <= 35; lon++) {
    CELLS.push({ lat, lon });
  }
}
// Moscow / Central Russia anchors
for (const [lat, lon] of [
  [55, 36],
  [55, 37],
  [55, 38],
  [54, 36],
  [54, 37],
  [56, 36],
  [56, 37],
]) {
  if (!CELLS.some((c) => c.lat === lat && c.lon === lon)) {
    CELLS.push({ lat, lon });
  }
}

function cellName({ lat, lon }) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  const la = String(Math.abs(lat)).padStart(2, "0");
  const lo = String(Math.abs(lon)).padStart(3, "0");
  return `Copernicus_DSM_COG_30_${ns}${la}_00_${ew}${lo}_00_DEM`;
}

function urlFor(cell) {
  const name = cellName(cell);
  return `https://copernicus-dem-90m.s3.amazonaws.com/${name}/${name}.tif`;
}

async function fetchOne(cell, retries = 3) {
  const name = cellName(cell);
  const dest = join(OUT, `${name}.tif`);
  if (existsSync(dest)) return "skip";
  mkdirSync(OUT, { recursive: true });
  const url = urlFor(cell);
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "AetherGroundStation/1.0 (Copernicus DEM)" },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      return "ok";
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

console.log(`Copernicus GLO-90: ${CELLS.length} COG tiles → public/dem`);
let ok = 0;
let skip = 0;
let fail = 0;
for (const cell of CELLS) {
  const name = cellName(cell);
  process.stdout.write(`\r ${name} …`);
  try {
    const r = await fetchOne(cell);
    if (r === "skip") skip++;
    else ok++;
  } catch (e) {
    fail++;
    console.warn(`\nfail ${name}: ${e}`);
  }
}
console.log(`\nDone: ok=${ok} skip=${skip} fail=${fail}`);

writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify(
    {
      product: "Copernicus DEM GLO-90 (COG)",
      source: "https://copernicus-dem-90m.s3.amazonaws.com/",
      license: "Copernicus DEM — free open data (AWS)",
      cells: CELLS.map((c) => ({
        ...c,
        file: `${cellName(c)}.tif`,
      })),
      fetchedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
