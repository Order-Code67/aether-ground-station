# V2 Implementation Progress

**Версия кода:** 0.7.0  
**Дата:** 2026-11-11

## 0.7.0

- **RTSP JPEG bridge:** `video_rtsp_bridge_*` — FFmpeg пишет live.jpg, UI поллит base64 кадры (без mock video).
- **GeoTIFF DEM sampling:** `terrain_sample_elevation` для uncompressed Float32/Int16 + ModelPixelScale/Tiepoint; иначе N/A.
- **Central Gateway client:** config, TCP/HTTP probe, PostgreSQL DSN probe, `sync_outbox`, `gateway_try_sync` → POST `/api/v1/sync`.
- **PDF reports:** `report_complex_pdf` (minimal PDF 1.4 из SQLite summary).
- **NSIS** уже в bundle; `docs/RELEASE_SIGNING.md` — подпись + updater scaffold.
- **Playwright** сценарии B–E (`e2e/scenarios-b-e.spec.ts`).

## 0.6.0

- FFmpeg status/probe, GeoTIFF inspect, Inventory/Maintenance/Reports JSON, Plugin Manager, telemetry SQLite, Playwright A smoke.

## 0.5.0

- Versioned SQLite migrations, Station Planner, Terrain profile, Pan-Tilt modes, permissions bind, Vitest, SSOT.

## Remaining / V2.1+

- Bundled FFmpeg binary (сейчас PATH)
- Tiled/compressed GeoTIFF, SRTM/Copernicus online
- Full PostgreSQL server service + TLS/WSS sessions
- Signed updater endpoint + Authenticode (нужен сертификат)
- WebRTC video relay
- Playwright на полном Tauri WebView2
