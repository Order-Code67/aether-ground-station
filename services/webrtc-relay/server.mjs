/**
 * Minimal WebRTC signaling relay (no media SFU, no pilot channel).
 * Rooms are ephemeral; peers exchange SDP/ICE via WebSocket.
 *
 *   npm run webrtc:relay
 */
import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.WEBRTC_PORT || 8790);
const HOST = process.env.WEBRTC_HOST || "127.0.0.1";

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      service: "aether-webrtc-signaling",
      rooms: rooms.size,
    }),
  );
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://${HOST}`);
  const room = url.searchParams.get("room") || "default";
  if (!rooms.has(room)) rooms.set(room, new Set());
  const peers = rooms.get(room);
  peers.add(ws);
  ws.send(JSON.stringify({ type: "joined", room, peers: peers.size }));

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    // Block actuator / pilot command types explicitly
    if (msg?.type === "pilot" || msg?.type === "actuator" || msg?.type === "fire") {
      ws.send(JSON.stringify({ type: "error", error: "forbidden channel" }));
      return;
    }
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === 1) {
        peer.send(JSON.stringify({ ...msg, room }));
      }
    }
  });

  ws.on("close", () => {
    peers.delete(ws);
    if (peers.size === 0) rooms.delete(room);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`WebRTC signaling ws://${HOST}:${PORT}/?room=demo`);
});
