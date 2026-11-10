# V2 Implementation Progress

**Версия кода:** 0.9.0 (+ S2 P0 hardening)  
**Дата:** 2026-11-11

## S3 — P1 reliability (post-S2)

- **RTSP bridge:** stderr drain, kill on app exit, first-frame timeout → no-signal, phase field.
- **Devices:** hydrate marks Online→Offline after restart; `device_intents` restore for Serial/RTSP.
- **Archive SSOT:** removed localStorage persist; SQLite `archive_state` via useSqliteSync.
- **Outbox:** migration v4 attempts/last_error; failed on HTTP error; `gateway_retry_failed`.
- **ACL:** station/inventory write → `require_role_write`; `docs/AETHER_PERMISSION_MATRIX.md`.
- **Video UI:** Connecting / Streaming labels (`connecting` / `streaming`).

## S2 — P0 security / data / build gates (post-0.9.0)

- **auth_login:** session role binds only after `db_verify_user_password`; `auth_bind_session` disabled.
- **db_restore:** SQLite restore + Settings UI (backup→mutate→restore path).
- **FFmpeg gate:** `npm run ffmpeg:check` / `pretauri:build` fails closed without bundled bins.
- **Gateway sync:** `X-Ags-Sync-Token` required; stub returns 401 without secret; desktop sends `syncSecret`.
- **Acceptance:** cargo 6, vitest 13 (auth/restore/syncSecret contracts), typecheck, build, critical, ffmpeg:check green.

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

- Run `ffmpeg:fetch` before release builds (binaries not in git); gate enforces at `tauri:build`.
- Production TLS CA + real CDN endpoints + Authenticode cert purchase.
- Media SFU for WebRTC (signaling only today).
- tauri-driver CDP attach for packaged WebView2.
- Next: **S3** P1 (RTSP hygiene, device reconnect, archive SSOT, outbox retry, permission matrix).
