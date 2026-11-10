# V2 Implementation Progress

**Версия кода:** 0.5.0  
**Дата:** 2026-11-11

## Выполнено в этой итерации

### Этап 1 — Core
- Versioned SQLite migrations (`schema_migrations`, v1→v2)
- Таблицы stations/complexes/terrain/inventory/diagnostics и др.
- Permission Engine: `auth_bind_session` + ACL на serial write/open + station upsert
- UI: `can()` на NavRail (settings/remote), Station Planner manageDevices
- Typed domain events (`domainEvents.ts`)
- DiagnosticsManager skeleton
- DeviceStatus `Reconnecting`
- SSOT: убран zustand persist localStorage для workspace/profiles → только SQLite sync
- Vitest: AMSL + profile import; `cargo test` AMSL formula
- docs/SCHEMA.md

### Этап 2 — Workspace
- Сохранён DnD constructor; SSOT через SQLite

### Этап 3 — Video
- Расширены состояния сигнала (§6): no-signal, recording, error

### Этап 4–6 — Map / Station / Terrain
- Station Planner UI + CRUD (SQLite)
- AMSL formula enforced FE+BE
- Map markers для станций + азимут в popup
- Terrain Engine: adapters, linear profile, N/A без DEM, ручные отметки

### Этап 8 — Pan-Tilt
- Simulation / Monitoring / Local Device Status (без remote actuators)

## Ещё не сделано (следующие итерации)
- FFmpeg Video Capture Service (реальный RTSP)
- GeoTIFF DEM parser
- PostgreSQL / Central Gateway runtime
- Playwright E2E A–E
- Plugin Manager runtime
- Полный Inventory/Maintenance/Reports UI
- Signed NSIS + updater
