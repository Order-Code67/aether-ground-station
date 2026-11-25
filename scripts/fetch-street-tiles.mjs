/**
 * Offline street basemap (names of streets / places) into public/tiles-streets.
 * Source: CARTO Voyager raster tiles (© OpenStreetMap · © CARTO) — free, no API key.
 *
 * Coverage:
 *   world z0–4
 *   Central Russia z5–11
 *   Smolensk oblast z12–13
 *   Smolensk city z14–16 (street names)
 *
 * Usage: node scripts/fetch-street-tiles.mjs
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "tiles-streets");
/** Carto Voyager — OSM streets + Russian place/street labels. */
const TEMPLATE =
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";
/** Labels-only overlay for hybrid satellite + streets. */
const OUT_LABELS = join(ROOT, "public", "tiles-street-labels");
const TEMPLATE_LABELS =
  "https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png";

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

const SMOLENSK_CITY = {
  west: 31.92,
  south: 54.72,
  east: 32.18,
  north: 54.86,
};

const MIN_VALID_BYTES = 400;

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2tile(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
}

function destPath(root, z, x, y) {
  return join(root, String(z), String(x), `${y}.png`);
}

async function fetchTile(root, template, z, x, y, retries = 4) {
  const dest = destPath(root, z, x, y);
  if (existsSync(dest) && statSync(dest).size >= MIN_VALID_BYTES) return "skip";
  if (existsSync(dest)) unlinkSync(dest);
  mkdirSync(dirname(dest), { recursive: true });
  const url = template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "AetherGroundStation/1.1 (offline streets; OSM/CARTO)",
          Referer: "https://carto.com/",
        },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      return "ok";
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function downloadSet(root, template, list, label, concurrency = 12) {
  let i = 0;
  let ok = 0;
  let skip = 0;
  let fail = 0;
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      const t = list[idx];
      try {
        const r = await fetchTile(root, template, t.z, t.x, t.y);
        if (r === "skip") skip++;
        else ok++;
      } catch (e) {
        fail++;
        if (fail <= 12) console.warn(String(e));
      }
      const done = ok + skip + fail;
      if (done % 80 === 0 || done === list.length) {
        process.stdout.write(
          `\r ${label} ${done}/${list.length} (ok=${ok} skip=${skip} fail=${fail})   `,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`\nDone ${label}: ok=${ok} skip=${skip} fail=${fail} → ${root}`);
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

const streetJobs = [
  ...worldZooms(4),
  ...bboxZooms(CENTRAL_RUSSIA, 5, 11),
  ...bboxZooms(SMOLENSK_OBLAST, 12, 12),
  ...bboxZooms(SMOLENSK_CITY, 13, 16),
];
/** Labels overlay: lighter set — enough for hybrid street names in cities. */
const labelJobs = [
  ...worldZooms(4),
  ...bboxZooms(CENTRAL_RUSSIA, 5, 11),
  ...bboxZooms(SMOLENSK_CITY, 12, 16),
];
const key = (t) => `${t.z}/${t.x}/${t.y}`;
const uniq = [...new Map(streetJobs.map((t) => [key(t), t])).values()];
const uniqLabels = [...new Map(labelJobs.map((t) => [key(t), t])).values()];
console.log(
  `CARTO Voyager streets · ${uniq.length} + labels ${uniqLabels.length} → public/tiles-streets`,
);

function clearOut(dir) {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name === "manifest.json") continue;
    const p = join(dir, name.name);
    if (name.isDirectory()) rmSync(p, { recursive: true, force: true });
    else unlinkSync(p);
  }
}

const skipClear = process.argv.includes("--keep");
if (!skipClear) {
  console.log("Clearing previous street tiles…");
  clearOut(OUT);
  clearOut(OUT_LABELS);
}

const base = await downloadSet(OUT, TEMPLATE, uniq, "streets");
if (base.fail > 0) {
  console.log("Retrying failed street tiles…");
  await downloadSet(OUT, TEMPLATE, uniq, "streets-retry", 8);
}

const labels = await downloadSet(
  OUT_LABELS,
  TEMPLATE_LABELS,
  uniqLabels,
  "street-labels",
);
if (labels.fail > 0) {
  console.log("Retrying failed label overlay tiles…");
  await downloadSet(
    OUT_LABELS,
    TEMPLATE_LABELS,
    uniqLabels,
    "labels-retry",
    8,
  );
}

const meta = {
  source: "CARTO Voyager (© OpenStreetMap contributors · © CARTO)",
  templateLocal: "/tiles-streets/{z}/{x}/{y}.png",
  labelsTemplateLocal: "/tiles-street-labels/{z}/{x}/{y}.png",
  coverage: {
    centralRussia: CENTRAL_RUSSIA,
    smolenskOblast: SMOLENSK_OBLAST,
    smolenskCity: SMOLENSK_CITY,
    zooms:
      "world 0–4 · Central Russia 5–11 · Smolensk oblast 12–13 · city 14–16",
  },
  tileCount: uniq.length,
  labelTileCount: uniqLabels.length,
  fetchedAt: new Date().toISOString(),
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(meta, null, 2));
writeFileSync(join(OUT_LABELS, "manifest.json"), JSON.stringify(meta, null, 2));
console.log("Wrote manifests for tiles-streets and tiles-street-labels");
