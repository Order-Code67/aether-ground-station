# Terrain Map — план интеграции (ТЗ 3D Terrain Map)

**Дата:** 2026-11-13  
**Модуль UI:** `src/modules/terrainMap` → вкладка «Карта»

## Решение по движку

| Слой | Выбор | Почему |
|------|--------|--------|
| 2D геокарта | Существующий **slippy DOM** (Esri Imagery + Terrarium hillshade) | Уже стабилен offline в Tauri; MapLibre worker ранее ломал CSP/высоту |
| 3D рельеф | **Three.js** `TerrainMesh3D` + DEM samples | Уже в проекте; без второго GL-стека |
| Профиль / Френель | `linkProfile.ts` + `fresnel.ts` | Чистая геометрия, без fake RF |

MapLibre **не** возвращаем без отдельного этапа. API-ключи карт — через настройки/локальные тайлы, не в Git.

## Что реализовано (wave-1)

- Shell: вкладки Карта / 3D / Профиль / Телеметрия / Радиовидимость / Антенны  
- Правая панель: связь, PAN/TILT (sim), радиус 1…max км, патч, каталог антенн, DEMO  
- Нижний профиль высот + LOS + 1-я зона Френеля + препятствие  
- Дрон DEMO на карте + линия НСУ→дрон  
- Радиус R=… км, сектора патчей (из planner)  
- Persist `terrain_map_settings` в SQLite JSON  
- DEMO явно маркирован; write на ESP32 **нет**

## Пока не полностью

- Полноценный 3D pitch/orbit «как MapLibre terrain» на всю область радиуса  
- Contour isolines на 2D (есть hillshade + легенда)  
- MAVLink/CRSF/ELRS live drone adapters (есть слот liveDrone)  
- Local ESP32 servo **write** (только после OK)  
- Отдельные SQLite таблицы GroundStations/… — reuse stations + kv_json  

## Приёмка (smoke)

1. Открыть «Карта и планирование» → «Карта»  
2. DEMO дрон + радиус + профиль  
3. Слайдер радиуса меняет кольцо  
4. Статус радиовидимости зелёный/жёлтый/красный/серый  
5. DEMO OFF не подставляет DEMO за LIVE  
