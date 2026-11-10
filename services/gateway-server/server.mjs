/**
 * Minimal Central Gateway sync receiver (Node).
 * Accepts POST /api/v1/sync batches from desktop outbox.
 * Persists to local JSONL (stand-in for PostgreSQL ingest). No pilot channel.
 *
 *   node services/gateway-server/server.mjs
 *   GATEWAY_PORT=8787 node services/gateway-server/server.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.GATEWAY_PORT || 8787);
const LOG = path.join(__dirname, "sync-ingest.jsonl");

const server = http.createServer(async (req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "aether-gateway-stub" }));
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/api/v1/sync")) {
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
    const line = JSON.stringify({
      at: new Date().toISOString(),
      items: parsed.items ?? [],
    });
    fs.appendFileSync(LOG, line + "\n", "utf8");
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        accepted: Array.isArray(parsed.items) ? parsed.items.length : 0,
        note: "JSONL ingest; wire PostgreSQL on production server",
      }),
    );
    return;
  }
  res.writeHead(404, { ...cors, "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Aether Gateway stub http://127.0.0.1:${PORT}`);
  console.log(`Ingest log: ${LOG}`);
});
