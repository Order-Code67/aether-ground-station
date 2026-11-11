/**
 * Download dark basemap tiles into public/tiles for offline MapLibre.
 * Source: Carto Dark Matter (raster). For bundling into desktop app only.
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

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2tile(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
}

async function fetchTile(z, x, y) {
  const url = TEMPLATE.replace("{z}", z)
    .replace("{x}", x)
    .replace("{y}", y);
  const dest = join(OUT, String(z), String(x), `${y}.png`);
  if (existsSync(dest)) return "skip";
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url, {
    headers: { "User-Agent": "AetherGroundStation/1.0 (offline bundle)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return "ok";
}

async function downloadSet(list, concurrency = 8) {
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
        if (fail < 8) console.warn(String(e));
      }
      if ((ok + skip + fail) % 50 === 0) {
        process.stdout.write(
          `\r tiles ${ok + skip + fail}/${list.length} (ok=${ok} skip=${skip} fail=${fail})`,
        );
      }
    }
  }
  await Promise.all(
    Array.from({ length: concurrency }, () => worker()),
  );
  console.log(
    `\nDone: ok=${ok} skip=${skip} fail=${fail} → ${OUT}`,
  );
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

function bboxZooms(west, south, east, north, zMin, zMax) {
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
  // Moscow metro area (detail)
  ...bboxZooms(36.8, 55.3, 38.4, 56.1, 5, 11),
];

// de-dupe
const key = (t) => `${t.z}/${t.x}/${t.y}`;
const uniq = [...new Map(jobs.map((t) => [key(t), t])).values()];
console.log(`Fetching ${uniq.length} tiles into public/tiles …`);
await downloadSet(uniq);
