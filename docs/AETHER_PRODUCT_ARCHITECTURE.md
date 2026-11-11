# Aether Ground Station — Product Architecture (честная матрица)

**Дата:** 2026-11-11  
**Ветка:** `feature/gs-1-dashboard-navigation`  
**SSOT:** SQLite schema **v5**  
**Стек:** Tauri 2 · React 19 · Zustand · MapLibre · FFmpeg · rusqlite  

---

## Вердикт

Есть каркас + **wave-2 Station Planner**: 4-pane layout (дерево \| карта \| карточка \| инженерия), GS-PT симуляция с 3D (Three.js), sync az↔карта↔look-at B, профиль рельефа по азимуту.  
**Ограничения:** нет remote actuator commands; DEM mesh 3D рельефа ещё нет; coverage/RF heatmaps не фейкаются.

---

## Матрица «есть / gap»

| Область | Есть (каркас) | Gap (wave-2) |
|---------|---------------|--------------|
| Nav 8 разделов | Да | Visual polish industrial |
| Dashboard | Complex/site из planner, реальные counts | Widget layouts per role packs |
| TopBar | Complex + Site selectors | Notifications feed |
| StatusBar | Devices/video/tel/warnings/**last update** | Telemetry richer |
| Complex/Site/Station | CRUD + filter | Org layer; docs/photos |
| MapLibre | 4-pane planner; markers; sim az + look-at B | Satellite layers polish |
| Mast/Antenna | Catalogs + mounts | Full RF docs UI |
| Terrain | A–B + CSV + az-coupled + **3D DEM mesh** (N/A without DEM) | denser mesh / worker |
| Pan-Tilt | Sim/Monitor + 3D + map sync + **adapter contract** (fact=Н/Д) | Real COM/USB angle stream |
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

## Wave-2 (реализовано на feature-ветке)

1. **GS-3** — 4-pane Station Planner (`StationPlannerView`)  
2. **GS-PT** — pan-tilt + Three.js + map sync (без команд на приводы)  
3. **GS-5** — профиль A=станция → B=look-at по азимуту  

Далее: реальный COM/USB angle stream; merge main — только по OK.
