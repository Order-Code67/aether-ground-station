# Map — Offline / Local XYZ

**UI:** Map panel → режим тайлов: `Офлайн` | `Локальные XYZ` | `OSM`.

## Offline (без тайлов)

- Стиль `offlineStyle()` — только тёмный background.
- Маркеры станций, азимуты и measure работают без сети.
- Подходит для air-gapped стенда.

## Local XYZ

1. Поднимите локальный тайловый сервер (например `tileserver-gl`, `mbtileserver`, или статику `/{z}/{x}/{y}.png`).
2. В Map panel выберите **Локальные XYZ**.
3. Введите шаблон URL, например:
   - `http://127.0.0.1:8080/data/osm/{z}/{x}/{y}.png`
   - `http://127.0.0.1:8081/{z}/{x}/{y}.png`
4. Карта должна показать растр без обращения к `tile.openstreetmap.org`.

## Smoke checklist

- [ ] Offline: карта инициализируется без network errors в console.
- [ ] Local XYZ: тайлы грузятся с localhost (Network tab → 200).
- [ ] Станции с координатами видны как markers + azimuth line.
- [ ] OSM mode (optional): online tiles when network allowed.

Код: `src/modules/map/mapStyles.ts`, `MapPanel.tsx`.
