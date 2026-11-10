/**
 * Central Gateway sync receiver — JSONL and optional PostgreSQL + TLS.
 *
 *   npm run gateway:stub
 *   GATEWAY_TLS=1 DATABASE_URL=postgres://... npm run gateway:stub
 *
 * No pilot / actuator channel.
 */
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.GATEWAY_PORT || 8787);
const HOST = process.env.GATEWAY_HOST || "127.0.0.1";
const LOG = path.join(__dirname, "sync-ingest.jsonl");
const TLS = process.env.GATEWAY_TLS === "1" || process.env.GATEWAY_TLS === "true";
const DATABASE_URL = process.env.DATABASE_URL || "";
/** Required for POST /api/v1/sync. Empty → reject all sync (401). */
const SYNC_SECRET = process.env.GATEWAY_SYNC_SECRET || "";

let pgPool = null;

function readHeader(req, name) {
  const key = name.toLowerCase();
  const raw = req.headers[key];
  if (Array.isArray(raw)) return raw[0] || "";
  return raw || "";
}

async function initPg() {
  if (!DATABASE_URL) return null;
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: DATABASE_URL,
      ssl:
        process.env.PGSSLMODE === "require"
          ? { rejectUnauthorized: process.env.PGSSL_REJECT !== "0" }
          : undefined,
    });
    await pool.query("SELECT 1");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await pool.query(schema);
    console.log("PostgreSQL connected");
    return pool;
  } catch (e) {
    console.warn("PostgreSQL unavailable, JSONL only:", e.message);
    return null;
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Ags-Sync-Token",
};

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "aether-gateway",
        tls: TLS,
        postgres: Boolean(pgPool),
        syncAuthRequired: true,
      }),
    );
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/api/v1/sync")) {
    const token = readHeader(req, "x-ags-sync-token");
    if (!SYNC_SECRET || token !== SYNC_SECRET) {
      res.writeHead(401, { ...cors, "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: "unauthorized",
          hint: "Set GATEWAY_SYNC_SECRET and send X-Ags-Sync-Token",
        }),
      );
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString("utf8");
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "invalid json" }));
      return;
    }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const line = JSON.stringify({ at: new Date().toISOString(), items });
    fs.appendFileSync(LOG, line + "\n", "utf8");

    let pgAccepted = 0;
    if (pgPool) {
      for (const item of items) {
        const id = String(item.id ?? `anon_${Date.now()}`);
        const kind = String(item.kind ?? "unknown");
        const payload = item.payload ?? item;
        try {
          await pgPool.query(
            `INSERT INTO sync_events(id, kind, payload)
             VALUES($1,$2,$3::jsonb)
             ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, received_at=now()`,
            [id, kind, JSON.stringify(payload)],
          );
          pgAccepted += 1;
        } catch (e) {
          console.warn("pg insert failed", id, e.message);
        }
      }
    }

    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        accepted: items.length,
        postgres: pgAccepted,
        note: pgPool
          ? "JSONL + PostgreSQL"
          : "JSONL only (set DATABASE_URL for PG)",
      }),
    );
    return;
  }
  res.writeHead(404, { ...cors, "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
}

pgPool = await initPg();

const server = TLS
  ? (() => {
      const keyPath = path.join(__dirname, "certs", "server.key");
      const crtPath = path.join(__dirname, "certs", "server.crt");
      if (!fs.existsSync(keyPath) || !fs.existsSync(crtPath)) {
        console.error("TLS requested but certs missing. Run scripts/gen-gateway-certs.ps1");
        process.exit(1);
      }
      return https.createServer(
        {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(crtPath),
        },
        (req, res) => void handle(req, res),
      );
    })()
  : http.createServer((req, res) => void handle(req, res));

server.listen(PORT, HOST, () => {
  const scheme = TLS ? "https" : "http";
  console.log(`Aether Gateway ${scheme}://${HOST}:${PORT}`);
  console.log(`Ingest log: ${LOG}`);
});
