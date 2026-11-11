/**
 * Download dark basemap tiles into public/tiles for offline MapLibre.
 * Source: Carto Dark Matter (raster). For bundling into desktop app only.
 *
 * Coverage:
 *  - World overview z0–z4
 *  - Central Russia (incl. Smolensk Oblast) z5–z11
 *  - Smolensk Oblast detail z12
 *
 * Usage: node scripts/fetch-offline-tiles.mjs
 */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "tiles");
const TEMPLATE =
  "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png";

/** Central Federal District envelope — west edge covers Smolensk Oblast. */
const CENTRAL_RUSSIA = {
  west: 30.5,
  south: 51.0,
  east: 42.0,
  north: 58.5,
};

/** Smolensk Oblast (область) — higher zoom detail. */
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

async function fetchTile(z, x, y, retries = 3) {
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
        headers: { "User-Agent": "AetherGroundStation/1.0 (offline bundle)" },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      return "ok";
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function downloadSet(list, concurrency = 12) {
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
        if (fail <= 12) console.warn(String(e));
      }
      const done = ok + skip + fail;
      if (done % 100 === 0 || done === list.length) {
        process.stdout.write(
          `\r tiles ${done}/${list.length} (ok=${ok} skip=${skip} fail=${fail})   `,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`\nDone: ok=${ok} skip=${skip} fail=${fail} → ${OUT}`);
  return { ok, skip, fail };
}

function worldZooms(maxZ) {
  const out = [];
  for (let z = 0; z <= maxZ; z++) {
    const n = 2 ** z;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) out.push({ z, x, y });
    }
  }
  return out;
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
  ...worldZooms(4),
  ...bboxZooms(CENTRAL_RUSSIA, 5, 11),
  ...bboxZooms(SMOLENSK_OBLAST, 12, 12),
];

const key = (t) => `${t.z}/${t.x}/${t.y}`;
const uniq = [...new Map(jobs.map((t) => [key(t), t])).values()];
console.log(
  `Central Russia + Smolensk: fetching ${uniq.length} tiles into public/tiles …`,
);
const result = await downloadSet(uniq);
if (result.fail > 0) {
  console.log("Retrying failed tiles once…");
  await downloadSet(uniq, 8);
}
