# Aether Ground Station 1.0.0 — Release Notes

**Дата:** 2026-11-11  
**Тип:** offline desktop MVP (подтверждённый автоматический контур + P0/P1 hardening)

## READY

- SQLite SSOT (migrations v1–4), backup/restore
- Auth: `auth_login` session binding; Observer write blocked
- Stations / AMSL (null → N/A); Device Manager + Serial/USB paths
- Video: UVC + RTSP JPEG bridge (FFmpeg bundled gate); signal Connecting/Streaming
- Terrain: Float32 strip / Deflate / tiled DEM sampling; LZW/JPEG → N/A
- Telemetry adapters + history reload from SQLite
- Archive clips metadata in SQLite (no localStorage SSOT)
- Gateway outbox with sync secret + failed/retry (Preview)
- Map offline / local XYZ; NSIS unsigned packaging scaffold
- Tests: typecheck, vitest, cargo, critical, Playwright A–F

## Preview (labelled in UI)

- Central Gateway HTTP/TLS/PG probe — not production multi-tenant
- WebRTC — **signaling only** (no MediaStream/SFU)

## NOT included in 1.0.0

- WebRTC media / SFU / TURN
- Authenticode mandatory signing / live updater CDN
- Remote pilot / actuators / MAVLink uplink
- LZW/JPEG/BigTIFF via GDAL
- Robotics/Aerial deep integrations

## Known limitations

- HW lab matrix rows still need fill-in on reference machine (`AETHER_HW_LAB_CHECKLIST.md`)
- Packaged WebView2 CDP e2e optional (`test:e2e:tauri`)
- Run `npm run ffmpeg:fetch` before release builds (gate fails closed)

## Upgrade

1. Backup operator SQLite before install.
2. Install NSIS 1.0.0 over previous.
3. Login required after upgrade (no spoof bind restore).
