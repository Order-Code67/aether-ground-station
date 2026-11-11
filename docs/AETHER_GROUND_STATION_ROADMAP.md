# Aether Ground Station — Product Roadmap (GS-0…GS-10)

**Документ:** `AETHER_GROUND_STATION_ROADMAP.md`  
**Целевая платформа:** Windows 11 x64  
**База:** 1.0.0  
**Правило:** не реализовывать GS-0–GS-10 одним diff; каждый этап — отдельная задача, тесты, приёмка.  
**Запрет:** push / merge main / tag / publish без согласования.

Параллельный трек **1.0.1** (SEC/HW lab) не смешивать в один PR с UX big-bang; можно cherry-pick security fixes.

---

## Обзор этапов

| Этап | Название | Оценка риска | Зависит от |
|------|----------|--------------|------------|
| **GS-0** | Product Audit & UX Blueprint | Low | — |
| **GS-1** | Dashboard & Navigation (chrome) | Medium | **DONE** — TopBar complex/site, StatusBar last-update, Dashboard planner summary |
| **GS-2** | Complex & Site Manager | Medium | **Каркас DONE** (schema v5 CRUD) |
| **GS-3** | Station Planner | Medium–High | **Каркас** (map drag, store); **gap:** единый 4-pane layout |
| **GS-4** | Mast & Antenna Manager | Medium | **Каркас DONE** |
| **GS-5** | Terrain Engine | Medium | **Каркас** (A–B + CSV); **gap:** az-coupled + 3D DEM |
| **GS-6** | Device Manager hub UX | Medium | **Каркас DONE** |
| **GS-7** | Video Center | High (HW) | **Каркас**; HW lab separate |
| **GS-8** | Telemetry Center | Medium | **Каркас** |
| **GS-9** | Event Center & Diagnostics | Low–Medium | **Каркас DONE** |
| **GS-10** | Workspace & Integration | Medium | **Каркас**; полная §15 — backlog |
| **GS-PT** | Pan-Tilt visualization | High | **NOT DONE** (shell only; no 3D/map sync) |

GS-6/7/8 могут частично идти параллельно после GS-1 **только** если не ломают shared `ModuleId` / DeviceManager.

---

## GS-0 — Product Audit & UX Blueprint

**Deliverables:** 6 docs (audit, UX, remove/keep, module arch, roadmap, acceptance).  
**Code:** не менять.  
**Exit:** согласование решений пользователем. **DONE** (docs).

### GS-3D+ (после GS-3) — 3D Station Planner visual

Не смешивать с GS-1. См. `AETHER_3D_STATION_PLANNER_ARCHITECTURE.md`: MapLibre + later Three.js / DEM mesh / parametric mast-antenna / Pan-Tilt 3D monitor. Three.js **не** добавлять до отдельного этапа.

---

## GS-1 — Dashboard & Navigation

**Scope:** 8-разделный Nav; Главная (виджеты); unified status mapping; role landing; HIDE Robotics/Aerial/Remote из primary.  
**Reuse:** AppShell, NavRail, workspace_layouts, DeviceManager counts, event_log, report_complex_summary.  
**ADD:** Dashboard view, disk space helper (optional), EntityStatus.  
**Tests:** typecheck, vitest nav/status, e2e smoke login→Главная.  
**Risks:** сломать ModuleId deep links / Playwright; Observer видит Advanced.  
**Mitigation:** mapping layer legacy→section; feature flags.

---

## GS-2 — Complex & Site Manager

**Scope:** CRUD complexes/sites; дерево; привязка станций; filter isolation.  
**Schema:** v5 minimal (`site.complex_id`, station status/description/created_at) — только после OK.  
**Reuse:** `complexes`, `station_sites`, `stations`, inventory list.  
**Tests:** rust CRUD/FK; e2e create complex→site→station.  
**Risks:** migration break backup; profiles confusion.  
**Mitigation:** migration tests + backup restore check; MOVE profiles UI.

---

## GS-3 — Station Planner

**Scope:** единый экран карта+карточка; select/move coords; az display; AMSL N/A-safe (nullable mast); offline maps.  
**Reuse:** MapPanel, StationsPanel, station_* cmds.  
**ADD:** stationPlannerStore.  
**Risks:** map worker packaged; state desync.  
**Mitigation:** single store; no MapLibre replace.

---

## GS-4 — Mast & Antenna Manager

**Scope:** catalog UI; types; mounts; N/A for unknown RF params; bind to station.  
**Reuse:** mast_profiles, antenna_profiles tables.  
**ADD:** mounts table / cmds.  
**Risks:** inventing antenna specs in UI defaults.  
**Mitigation:** empty→N/A policy tests.

---

## GS-5 — Terrain Engine

**Scope:** source meta clarity; raw vs tiles vs samples; A–B profile on map; export; persist terrain_profiles; disclaimer RF.  
**Reuse:** terrain Rust + terrainEngine.ts.  
**Risks:** DEM format edge cases; UI promises link quality.  
**Mitigation:** explicit unsupported→N/A; copy review.

---

## GS-6 — Device Manager (hub)

**Scope:** MERGE USB/Serial/Network/HID into Оборудование; card with history/errors; reconnect where adapter supports.  
**Reuse:** DeviceManager, serial/usb/ethernet cmds.  
**Risks:** regression per-connection flows.  
**Mitigation:** tabs keep old panels as embedded; HW tests separate.

---

## GS-7 — Video Center

**Scope:** multi-source layouts; UVC/HDMI/RTSP/Walksnail; record+archive; honest statuses; FFmpeg existing backend.  
**HIDE:** WebRTC media until PASS.  
**Risks:** UVC permission FAIL; FFmpeg orphans; RAM JPEG poll.  
**Mitigation:** no fake Live; lab checklist; reuse bridge hygiene.

---

## GS-8 — Telemetry Center

**Scope:** adapters ESP32/PX4/ArduPilot (parse/display); GPS/volt/temp N/A; charts; history; export.  
**Reuse:** normalize.ts, telemetry_append/list.  
**Risks:** fake series; pilot creep.  
**Mitigation:** monitor-only; no MAVLink uplink.

---

## GS-9 — Event Center & Diagnostics

**Scope:** filter/category/search/export; retention UI; disk warnings; reports entry.  
**Reuse:** event_log prune, audit_log, diagnostic_reports, PDF summary.  
**Risks:** log growth UI perf.  
**Mitigation:** pagination + existing prune.

---

## GS-10 — Workspace & Integration

**Scope:** Operator/Engineer/Admin packs; cross-module selection sync; regression full suite; installed smoke; docs/release notes draft.  
**Risks:** layout migration; role matrix holes.  
**Mitigation:** template migration + permission tests.  
**Release:** только после явного OK (no push/tag alone).

---

## Критерии проверки на каждом этапе

```
npm run typecheck
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:critical
npm run test:e2e
```

+ migrations / backup / roles / workspace save / no false HW PASS.

---

## Связь с версиями продукта

| Версия | Фокус |
|--------|--------|
| 1.0.1 | Security/reliability (idle TTL, secret seal, log prune, HW lab) |
| 1.1.0 | WebRTC media, signing, updater (backlog) |
| 1.2.x | Product UX + Complex/Planner/Mast/Antenna/Terrain centers (этот roadmap) |

Точный номер релиза после GS-10 — согласовать отдельно.

*Конец Roadmap.*
