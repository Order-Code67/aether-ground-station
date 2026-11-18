# Aether Ground Station — 3D Station Planner Architecture

**Документ:** `AETHER_3D_STATION_PLANNER_ARCHITECTURE.md`  
**Дата:** 2026-11-11  
**Статус:** architecture only (код Three.js / DEM-mesh **не** в GS-1)  
**Связь:** после GS-3 (MapLibre Station Planner UX); подэтап **GS-3D+**

---

## 1. Цель

Центральный пространственный модуль: географическая карта + реальный рельеф + параметрические мачты/антенны + геометрия направленности + визуализация Pan-Tilt (simulation / monitoring / local status).

**Не цель:** прогноз радиосвязи / качества видео от одной геометрии профиля.

---

## 2. Слои визуализации

| Слой | Технология | Данные |
|------|------------|--------|
| Геокарта 2D/pitch | **MapLibre GL JS** (уже в проекте) | OSM / offline XYZ / local tiles |
| Высоты sample | Terrain Engine + Rust GeoTIFF | `terrain_sources`, sampled AMSL |
| 3D объекты станции | **Three.js** (добавить позже) | mast/antenna/pan-tilt params из SQLite |
| DEM mesh | Three.js terrain или совместимый mesh из DEM | отдельно от map tiles |
| Профиль A–B | 2D chart (существующий linear profile) | `terrain_profiles` |

**Правило:** не заменять MapLibre. Three.js — overlay/panel рядом или synchronized camera, не второй картографический движок.

---

## 3. Раздельные сущности высот

1. **Raw DEM** — файл/источник (`terrain_sources`)  
2. **Sampled values** — точки/профиль из sample API  
3. **Map tiles** — растровые XYZ (не высоты)  
4. **3D mesh cache** — производный артефакт (будущее; путь/hash в payload источника)

Смешивать вертикальные датумы без явного преобразования — запрещено. Нет DEM → UI: «Данные высот отсутствуют» / N/A. **Не подставлять 0.**

---

## 4. AMSL

`Antenna AMSL = Ground AMSL + Mast Height + Antenna Offset`  
только если все слагаемые известны и в метрах. Иначе N/A.

Раздельно хранить: поверхность земли, основание мачты, высота мачты, offset антенны, вычисленный AMSL.

---

## 5. Pan-Tilt (safety)

Режимы: **SIMULATION** | **MONITORING** | **LOCAL DEVICE STATUS**.  
Разрешено: виртуальные углы, отображение фактических датчиков, 3D ориентация.  
**Запрещено:** remote actuator / servo command paths / удалённое управление приводами.

DEMO/SIMULATION значения явно маркировать.

---

## 6. Зависимости и производительность

- Three.js — добавить только на этапе GS-3D+ после анализа размера бандла и WebView2.  
- Тяжёлый DEM → **Web Worker** (decode/mesh), UI не блокировать.  
- Параметрические мачты/антенны (геометрия из высоты/типа), не набор растровых «картинок» как единственная модель.

---

## 7. Вкладки модуля «Карта и планирование» (целевые)

1. Карта  
2. 3D-рельеф  
3. Станции  
4. Мачты и антенны  
5. Геометрия и ориентация  
6. Профиль рельефа  
7. Сравнение станций  

В GS-1 доступны существующие map/stations/terrain/pantilt как sub-nav без Three.js.

---

## 8. Переиспользование

MapPanel, StationsPanel, TerrainPanel, PanTiltPanel, `terrain_*` commands, `station_*`, таблицы `mast_profiles` / `antenna_profiles` / `terrain_*`.

*Конец 3D Station Planner Architecture.*
