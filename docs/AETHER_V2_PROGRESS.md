# V2 Implementation Progress

**Версия кода:** 0.9.0  
**Дата:** 2026-11-11

## 0.9.0 — External resources / V2.1 scaffold

- **Bundled FFmpeg:** `npm run ffmpeg:fetch` → `src-tauri/resources/bin`; resolve bundled → PATH; NSIS `bundle.resources`.
- **GeoTIFF:** tiled + Deflate (8/Adobe) sampling; LZW/JPEG → N/A.
- **Gateway:** TLS certs script + optional `DATABASE_URL` PostgreSQL (`schema.sql`).
- **Updater:** `scripts/gen-updater-keys.ps1`, `tauri.updater.example.json`, CDN manifest example.
- **WebRTC relay:** `npm run webrtc:relay` signaling (no pilot).
- **Modules:** Robotics / Aerial / HID (monitor-only).
- **e2e Tauri:** `npm run test:e2e:tauri` + `e2e/tauri/`.

## 0.8.0

Map azimuth, PX4/ArduPilot, user admin, gateway stub, code-split.

## 0.7.0

RTSP bridge, DEM sample, Gateway outbox, PDF, Playwright B–E.

## Still external / ops

- Run `ffmpeg:fetch` before release builds (binaries not in git).
- Production TLS CA + real CDN endpoints + Authenticode cert purchase.
- Media SFU for WebRTC (signaling only today).
- tauri-driver CDP attach for packaged WebView2.
