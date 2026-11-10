# V2 Implementation Progress

**Версия кода:** 0.6.0  
**Дата:** 2026-11-11

## 0.6.0

- **Video Capture Service (partial):** `video_ffmpeg_status`, `video_probe_rtsp` (FFmpeg/ffprobe PATH); RTSP adapter probes before decode bridge.
- **Terrain GeoTIFF:** TIFF header/IFD inspect + register `terrain_sources`; elevation sampling still N/A until raster DEM reader.
- **Inventory / Maintenance / Reports** modules + SQLite commands.
- **Plugin Manager** registry (deny `*` / `system.exec`).
- **Telemetry → SQLite** `telemetry_records` on each normalized sample.
- **Playwright** e2e smoke (`npm run test:e2e`) for login shell + AMSL invariant.
- Rust unit tests: AMSL + minimal TIFF parse.

## 0.5.0

- Versioned SQLite migrations, Station Planner, Terrain profile, Pan-Tilt modes, permissions bind, Vitest, SSOT.

## Remaining

- Native RTSP→frame bridge / bundled FFmpeg
- Full GeoTIFF elevation sampling
- PostgreSQL Central Gateway
- PDF reports, signed NSIS + updater
- Full Playwright scenarios B–E on Tauri
