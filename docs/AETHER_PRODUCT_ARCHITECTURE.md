# Aether Ground Station — Product Architecture (честная матрица)

**Дата:** 2026-11-11  
**Ветка:** `feature/gs-1-dashboard-navigation`  
**SSOT:** SQLite schema **v5**  
**Стек:** Tauri 2 · React 19 · Zustand · MapLibre · FFmpeg · rusqlite  

---

## Вердикт

Есть **каркас** универсальной наземной станции (8 разделов, CRUD комплексов/станций, карта, каталоги, hubs).  
**Нет** ещё единой 4-pane Station Planner среды и полноценного GS-PT (3D / sync az↔карта↔рельеф).  
Three.js **не** подключён.

---

## Матрица «есть / gap»

| Область | Есть (каркас) | Gap (wave-2) |
|---------|---------------|--------------|
| Nav 8 разделов | Да | Visual polish industrial |
| Dashboard | Complex/site из planner, реальные counts | Widget layouts per role packs |
| TopBar | Complex + Site selectors | Notifications feed |
| StatusBar | Devices/video/tel/warnings/**last update** | Telemetry richer |
| Complex/Site/Station | CRUD + filter | Org layer; docs/photos |
| MapLibre | Markers, drag save, az line | Unified 4-pane; satellite layers |
| Mast/Antenna | Catalogs + mounts | Full RF docs UI |
| Terrain | A–B + CSV | Azimuth-coupled profile; 3D DEM mesh |
| Pan-Tilt | Sim/Monitor shell | 3D model; map sync; configurable ranges |
| Devices hub | Tabs COM/USB/Net/HID | Connection history table |
| Video | Panel + statuses | Multi-layout Video Center |
| Telemetry | Normalize + history | Charts polish; adapters UI |
| Events | Filter/search/export | Object deep-links |
| Workspace | Templates Operator/Engineer | Full §15 Basic/Advanced |

---

## Переиспользование

- `stationPlannerStore` — единый координатор complex/site/station  
- `DeviceManager` — runtime devices  
- `entityStatus` — единые статусы  
- Backend: `complex_*`, `site_*`, `station_*`, `mast/antenna/mount_*`, `terrain_*`, `system_disk_space`  

Не создавать второй SSOT / второй Device Manager / замену MapLibre.

---

## Следующие согласованные этапы (после GS-1 chrome)

1. **GS-3 layout** — 4-pane Station Planner  
2. **GS-PT** — pan-tilt visualization + map/terrain sync (Three.js только по OK)  
3. **GS-5 coupling** — профиль по азимуту  

Push / merge main / tag — только по явному согласованию.
