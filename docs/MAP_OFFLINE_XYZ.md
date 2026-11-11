# Map — Offline / Local XYZ

**UI:** Map panel → режим тайлов: `Офлайн (встроенные)` | `Локальные XYZ` | `OSM`.

## Offline (встроенные тайлы) — по умолчанию

- Стиль `offlineStyle()` → `/tiles/{z}/{x}/{y}.png` из `public/tiles`.
- Тёмная база (Carto Dark Matter), без интернета.
- Покрытия: мир z0–z5 + детализация Москва z6–z11.
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

## Smoke

- [ ] Offline: карта с растром без network errors
- [ ] Станции + azimuth line
- [ ] OSM (optional) при наличии сети

Код: `src/modules/map/mapStyles.ts`, `MapPanel.tsx`, `scripts/fetch-offline-tiles.mjs`.
