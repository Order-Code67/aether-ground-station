# Aether Ground Station — Product Architecture (честная матрица)

**Дата:** 2026-11-13  
**Ветка:** `feature/gs-1-dashboard-navigation`  
**SSOT:** SQLite schema **v5**  
**Стек:** Tauri 2 · React 19 · Zustand · slippy DOM map · FFmpeg · rusqlite · Three.js (pan-tilt / DEM mesh)

---

## Вердикт

Каркас + Station Planner (карта + наведение + инженерия): offline Esri Imagery, Terrarium hillshade, подписи, радиус, геометрический радиогоризонт, патчи видео/управления, DEM-коридор высот, пресеты наведения, pan-tilt симуляция + **read-only COM** угол-стрим.  
**Ограничения:** нет remote / local servo **write**; coverage/RF heatmaps не фейкаются; fact-углы = Н/Д без потока `serial-data`.

---

## Матрица «есть / gap»

| Область | Есть | Gap |
|---------|------|-----|
| Nav 8 разделов | Да | Visual polish |
| Dashboard | Complex/site, реальные counts | Widget packs по ролям |
| Map | Slippy XYZ (не MapLibre worker): спутник + DEM hillshade + labels | Больше offline регионы |
| Station Planner | Точка, направление, радиус, патчи, мачта, коридор, пресеты | Org docs/photos |
| Mast/Antenna | Catalogs + mounts + beamwidth→патчи | Полный RF docs UI |
| Terrain | A–B профиль, denser samples, 3D mesh (N/A без DEM) | Worker / denser mesh |
| Pan-Tilt | Sim + 3D + map; COM listen parse AZ/EL | Local servo write (после OK) |
| Devices hub | Tabs COM/USB/Net/HID | Connection history / reconnect UX |
| Video | Panel + statuses | Multi-layout Video Center |
| Telemetry | Normalize + history | Charts; adapters UI |
| Events | Filter/export | Object deep-links |
| Workspace | Templates | Full §15 |

---

## Переиспользование

- `stationPlannerStore` — complex/site/station + aiming SSOT  
- `DeviceManager` — runtime devices  
- `panTiltAdapter` — **read-only** fact angles  
- `aiming_presets` JSON в SQLite (`db_*_json`)  

Не создавать второй SSOT / второй Device Manager. База карты — slippy DOM; MapLibre worker не возвращать без отдельного этапа.

---

## Wave-3 (2026-11)

1. Ручное наведение на карте (патчи, коридор, мачта)  
2. Пресеты наведения  
3. COM pan-tilt **read** (`parsePanTiltAngles` + `createSerialPanTiltAdapter`)  
4. Процесс: `docs/AETHER_DEV_PROCESS.md`  

Далее: Device hub → Video → Telemetry → GS-10. Merge main — только по OK.
