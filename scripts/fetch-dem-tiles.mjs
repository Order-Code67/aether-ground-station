/**
 * Download free Terrarium DEM tiles (Mapzen / AWS elevation-tiles-prod)
 * for offline MapLibre 3D terrain + JS elevation sampling.
 *
 * License: public domain / open elevation data (Mapzen Terrarium encoding).
 * Source: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
 *
 * Coverage:
 *  - Central Russia z5–z10
 *  - Smolensk Oblast z11
 *
 * Usage: node scripts/fetch-dem-tiles.mjs
 */
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "dem-tiles");
const TEMPLATE =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const CENTRAL_RUSSIA = {
  west: 30.5,
  south: 51.0,
  east: 42.0,
  north: 58.5,
};

const SMOLENSK_OBLAST = {
  west: 30.7,
  south: 53.7,
  east: 35.5,
  north: 56.05,
};

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2tile(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
}

async function fetchTile(z, x, y, retries = 4) {
  const url = TEMPLATE.replace("{z}", z)
    .replace("{x}", x)
    .replace("{y}", y);
  const dest = join(OUT, String(z), String(x), `${y}.png`);
  if (existsSync(dest)) return "skip";
  mkdirSync(dirname(dest), { recursive: true });
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "AetherGroundStation/1.0 (offline DEM)" },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      return "ok";
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function downloadSet(list, concurrency = 16) {
  let i = 0;
  let ok = 0;
  let skip = 0;
  let fail = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      const t = list[idx];
      try {
        const r = await fetchTile(t.z, t.x, t.y);
        if (r === "skip") skip++;
        else ok++;
      } catch (e) {
        fail++;
        if (fail <= 16) console.warn(String(e));
      }
      const done = ok + skip + fail;
      if (done % 50 === 0 || done === list.length) {
        process.stdout.write(
          `\r dem ${done}/${list.length} (ok=${ok} skip=${skip} fail=${fail})   `,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`\nDone: ok=${ok} skip=${skip} fail=${fail} → ${OUT}`);
  return { ok, skip, fail };
}

function bboxZooms(bbox, zMin, zMax) {
  const { west, south, east, north } = bbox;
  const out = [];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2tile(west, z);
    const x1 = lon2tile(east, z);
    const y0 = lat2tile(north, z);
    const y1 = lat2tile(south, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) out.push({ z, x, y });
    }
  }
  return out;
}

const jobs = [
  ...bboxZooms(CENTRAL_RUSSIA, 5, 10),
  ...bboxZooms(SMOLENSK_OBLAST, 11, 11),
];

const key = (t) => `${t.z}/${t.x}/${t.y}`;
const uniq = [...new Map(jobs.map((t) => [key(t), t])).values()];
console.log(
  `Terrarium DEM Central Russia + Smolensk: ${uniq.length} tiles → public/dem-tiles`,
);

const result = await downloadSet(uniq);
if (result.fail > 0) {
  console.log("Retrying failed DEM tiles…");
  await downloadSet(uniq, 10);
}

writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify(
    {
      encoding: "terrarium",
      tileSize: 256,
      minzoom: 5,
      maxzoom: 11,
      attribution:
        "Mapzen Terrarium / AWS elevation-tiles-prod (open elevation)",
      coverage: {
        centralRussia: CENTRAL_RUSSIA,
        smolenskOblast: SMOLENSK_OBLAST,
      },
      tileCount: uniq.length,
      fetchedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log("Wrote public/dem-tiles/manifest.json");
