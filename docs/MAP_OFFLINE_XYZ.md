# Map — Offline / Local XYZ

**UI:** Map panel → режим тайлов: `Офлайн (встроенные)` | `Локальные XYZ` | `OSM`.

## Offline (встроенные тайлы) — по умолчанию

- Стиль `offlineStyle()` → `/tiles/{z}/{x}/{y}.png` из `public/tiles`.
- Тёмная база (Carto Dark Matter), без интернета.
- Покрытия:
  - мир z0–z4;
  - Центральная Россия (вкл. Смоленскую обл.) z5–z11: ≈30.5–42°E, 51–58.5°N;
  - Смоленская область z12: ≈30.7–35.5°E, 53.7–56.05°N.
- Маркеры станций, азимуты и measure работают всегда.

Обновить пакет:

```bash
npm run tiles:fetch
```

## Local XYZ

1. Тайловый сервер или свой шаблон URL.
2. Режим **Локальные XYZ**.
3. Пример: `http://127.0.0.1:8080/{z}/{x}/{y}.png`

## OSM онлайн

Требует сеть (`tile.openstreetmap.org`). CSP разрешает только этот хост для online-режима.

## 3D рельеф (Terrarium DEM)

Бесплатный офлайн DEM (Mapzen Terrarium / AWS `elevation-tiles-prod`):

- Тайлы: `public/dem-tiles/{z}/{x}/{y}.png`
- Центральная Россия z5–z10, Смоленская область z11
- Кнопка **3D рельеф** на карте → pitch + hillshade (MapLibre `raster-dem`)
- Сэмплер высот: `createTerrariumTileAdapter` (авто при старте)

```bash
npm run dem:fetch
```

Опционально Copernicus GLO-90 COG (AWS Open Data) → `vendor/dem-copernicus/`
(не входит в установщик; для локального GeoTIFF / анализа):

```bash
npm run dem:fetch:copernicus
```

## Smoke

- [ ] Offline: карта с растром без network errors
- [ ] 3D рельеф вкл → pitch ~58°, холмы Смоленска видны
- [ ] Станции + azimuth line
- [ ] OSM (optional) при наличии сети

Код: `src/modules/map/mapStyles.ts`, `MapPanel.tsx`, `scripts/fetch-offline-tiles.mjs`, `scripts/fetch-dem-tiles.mjs`.
