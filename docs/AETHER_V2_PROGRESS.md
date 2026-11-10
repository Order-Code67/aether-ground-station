# V2 Implementation Progress

**Версия кода:** 0.8.0  
**Дата:** 2026-11-11

## 0.8.0

- **Map:** азимутальные линии станций (GeoJSON) поверх domain markers.
- **Telemetry:** адаптеры PX4 / ArduPilot JSON (+ Vitest); null для отсутствующих полей.
- **Users:** `db_upsert_user` + UI Administrator в Settings; audit_log.
- **Gateway stub:** `npm run gateway:stub` → `services/gateway-server/server.mjs` (POST `/api/v1/sync`).
- **Perf:** lazy `WorkArea` code-split модулей (map/video и др.).

## 0.7.0

- RTSP JPEG bridge, GeoTIFF DEM sampling, Gateway outbox/probe, PDF, Playwright B–E, RELEASE_SIGNING.md.

## 0.6.0

- FFmpeg probe, GeoTIFF inspect, Inventory/Maintenance/Reports, Plugin Manager, telemetry SQLite, Playwright A.

## 0.5.0

- Migrations, Station Planner, Terrain, Pan-Tilt, permissions, Vitest, SSOT.

## V2.1+ (вне MVP-среза / нужны внешние ресурсы)

- Bundled FFmpeg binary; tiled/compressed GeoTIFF; production PostgreSQL+TLS Gateway; Authenticode + updater CDN; WebRTC relay; Robotics/Aerial/HID; Playwright на WebView2.
