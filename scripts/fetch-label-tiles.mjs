/**
 * Offline place/boundary labels (Esri World Boundaries and Places).
 * Stored as public/tiles-labels/{z}/{x}/{y}.png
 *
 * Usage: node scripts/fetch-label-tiles.mjs
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "tiles-labels");
const TEMPLATE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

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

function destPath(z, x, y) {
  return join(OUT, String(z), String(x), `${y}.png`);
}

async function fetchTile(z, x, y, retries = 4) {
  const dest = destPath(z, x, y);
  if (existsSync(dest) && statSync(dest).size > 500) return "skip";
  mkdirSync(dirname(dest), { recursive: true });
  const url = TEMPLATE.replace("{z}", z).replace("{y}", y).replace("{x}", x);
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "AetherGroundStation/1.0 (labels)" },
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

async function downloadSet(list, concurrency = 14) {
  let i = 0,
    ok = 0,
    skip = 0,
    fail = 0;
  async function worker() {
    while (i < list.length) {
      const t = list[i++];
      try {
        const r = await fetchTile(t.z, t.x, t.y);
        if (r === "skip") skip++;
        else ok++;
      } catch (e) {
        fail++;
        if (fail <= 10) console.warn(String(e));
      }
      const done = ok + skip + fail;
      if (done % 80 === 0 || done === list.length) {
        process.stdout.write(
          `\r labels ${done}/${list.length} (ok=${ok} skip=${skip} fail=${fail})   `,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`\nDone labels: ok=${ok} skip=${skip} fail=${fail}`);
  return { ok, skip, fail };
}

function bboxZooms(bbox, zMin, zMax) {
  const out = [];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2tile(bbox.west, z);
    const x1 = lon2tile(bbox.east, z);
    const y0 = lat2tile(bbox.north, z);
    const y1 = lat2tile(bbox.south, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) out.push({ z, x, y });
    }
  }
  return out;
}

function worldZooms(maxZ) {
  const out = [];
  for (let z = 0; z <= maxZ; z++) {
    const n = 2 ** z;
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++) out.push({ z, x, y });
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
console.log(`Label tiles: ${uniq.length} → public/tiles-labels`);
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT, { withFileTypes: true })) {
  if (name.name === "manifest.json") continue;
  const p = join(OUT, name.name);
  if (name.isDirectory()) rmSync(p, { recursive: true, force: true });
  else unlinkSync(p);
}
await downloadSet(uniq);
writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify(
    {
      source: "Esri World Boundaries and Places",
      templateLocal: "/tiles-labels/{z}/{x}/{y}.png",
      tileCount: uniq.length,
      fetchedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
