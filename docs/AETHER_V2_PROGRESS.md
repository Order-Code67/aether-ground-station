# V2 Implementation Progress

**Версия кода:** 1.0.0  
**Дата:** 2026-11-11

## 1.0.0 — Offline desktop MVP

- S1 audit → S2 P0 → S3 P1 → S4 P2 → S5 release candidate notes.
- See `docs/RELEASE_NOTES_1.0.0.md` for READY / Preview / NOT included.

## S4 — P2 evidence / terrain / telemetry / map (post-S3)

- **DEM:** cargo tests Deflate + tiled Float32 + LZW→N/A.
- **Telemetry:** `telemetry_list` + panel hydrate from SQLite on mount.
- **Map:** `docs/MAP_OFFLINE_XYZ.md` + vitest offline/XYZ styles.
- **HW lab:** `docs/AETHER_HW_LAB_CHECKLIST.md` template for matrix fill-in.
- **Station e2e:** Playwright F (CRUD/AMSL path in preview).

## S3 — P1 reliability (post-S2)

- **RTSP bridge:** stderr drain, kill on app exit, first-frame timeout → no-signal, phase field.
- **Devices:** hydrate marks Online→Offline after restart; `device_intents` restore for Serial/RTSP.
- **Archive SSOT:** removed localStorage persist; SQLite `archive_state` via useSqliteSync.
- **Outbox:** migration v4 attempts/last_error; failed on HTTP error; `gateway_retry_failed`.
- **ACL:** station/inventory write → `require_role_write`; `docs/AETHER_PERMISSION_MATRIX.md`.
- **Video UI:** Connecting / Streaming labels (`connecting` / `streaming`).

## S2 — P0 security / data / build gates (post-0.9.0)

- **auth_login:** session role binds only after `db_verify_user_password`; `auth_bind_session` disabled.
- **db_restore:** SQLite restore + Settings UI.
- **FFmpeg gate:** `ffmpeg:check` / `pretauri:build` fails closed.
- **Gateway sync:** `X-Ags-Sync-Token` required.

## 0.9.0 — External resources / V2.1 scaffold

- Bundled FFmpeg, tiled/Deflate DEM, Gateway TLS/PG, WebRTC signaling, Robotics/Aerial/HID monitor-only.

## Still external / ops

- Fill HW lab checklist on reference machine.
- Authenticode + updater CDN optional for 1.1.
- Media SFU for WebRTC (signaling only in 1.0).
