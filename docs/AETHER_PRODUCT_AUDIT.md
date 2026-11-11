# Aether Ground Station — Product Audit (GS-0)

**Документ:** `AETHER_PRODUCT_AUDIT.md`  
**Дата:** 2026-11-11  
**База:** 1.0.0 (`fa3e742` / tag) + tip docs/`b48b081`; локальная ветка аудита `release/1.0.1-validation` @ `f4fccbe`  
**Репозиторий:** https://github.com/Order-Code67/aether-ground-station  
**Объём этапа:** только аудит и документация — **код не изменялся** в рамках GS-0.

Связанные документы: `AETHER_UX_ARCHITECTURE.md`, `AETHER_REMOVE_REWORK_KEEP.md`, `AETHER_MODULE_ARCHITECTURE.md`, `AETHER_GROUND_STATION_ROADMAP.md`, `AETHER_GROUND_STATION_ACCEPTANCE.md`, `AETHER_GROUND_STATION_12_ARCHITECTURE.md` (технический аудит Station Planner 1.2).

---

## 1. Как выглядит программа сейчас

### 1.1 Оболочка

- Windows 11 desktop (Tauri 2) + браузерный preview.
- Вход: локальные роли Administrator / Operator / Observer.
- **Левый NavRail** с **~22 равнозначными пунктами** (`MODULES` в `src/types/app.ts`).
- Контент: один активный модуль в `WorkArea` (lazy + `ModuleErrorBoundary`).
- Параллельно: **Workspace Designer** (мультипанельная раскладка) — отдельный пункт меню.
- Нижний event log / device rail — через workspace layout, не через единый Dashboard.

### 1.2 Проблемы продукта (наблюдение аудита)

| Проблема | Следствие |
|----------|-----------|
| Слишком много пунктов верхнего уровня | Оператор и инженер видят один и тот же «лес» иконок |
| Devices / USB / Serial / Network / HID / Walksnail разведены | Дублирование «центра оборудования» |
| Map / Stations / Terrain / Pan-Tilt раздельно | Station Planner не ощущается как единый сценарий |
| Profiles vs Inventory vs Stations | Неясная иерархия «комплекс» |
| Remote + Gateway на главном уровне | Preview/outbox видны оператору |
| Robotics / Aerial — shell-экраны | Занимают место без полевой ценности |
| Нет Dashboard | Нет сводки комплекса / видео / телеметрии / БД |
| Статусы устройств ≠ статусы видео | Разные словари (`DeviceStatus` vs `VideoSignalState`) |
| HW lab 1.0.0 | Многие COM/UVC/RTSP пути **не подтверждены** на установленном билде |

### 1.3 Стек (подтверждён репозиторием)

Tauri 2 · React 19 · TypeScript · Zustand · MapLibre · SQLite (`rusqlite`) · FFmpeg (bundled NSIS) · Vitest · cargo test · Playwright.

---

## 2. Инвентаризация модулей

Легенда **Решение:** Сохранить | Доработать | Объединить | Перенести в Advanced | Скрыть до реализации | Предложить удаление (только после проверки зависимостей; на GS-0 ничего не удалять).

| Модуль | Состояние | Фактически | Железо / поле | Решение |
|--------|-----------|------------|---------------|---------|
| Auth / роли | Реально работающий | `auth_login`, Observer write guard, idle TTL (1.0.1 branch) | N/A | **Сохранить** |
| SQLite SSOT + migrations v1–4 | Реально работающий | Профили, events, stations, inventory, outbox… | Backup/restore cmds | **Сохранить** |
| Backup / Restore | Реально работающий | `db_backup` / `db_restore` | Нужен ручной smoke | **Сохранить** |
| Workspace Designer | Частично | Раскладки панелей, templates | UI OK | **Доработать** (ролевые пресеты) |
| Device Manager (ядро) | Реально работающий | Единый registry + reconnect hooks | Зависит от адаптеров | **Сохранить** |
| Devices UI | Частично | Список карточек | Без полной HW матрицы | **Объединить** → Оборудование |
| USB panel | Частично | `list_usb_devices` | Lab NOT_RUN / BLOCKED | **Объединить** → Оборудование (вкладка) |
| Serial / COM | Частично | open/read/write | Lab COM NOT_RUN | **Объединить** → Оборудование |
| Network | Частично | interfaces + TCP probe | OK как диагностика | **Перенести в Advanced** / вкладка Оборудование |
| HID | Частично | Gamepad API enum | Без привязки к приводам | **Скрыть** / Advanced |
| Video (UVC/MediaDevices) | Частично | Адаптер + статусы | UVC field FAIL (permission) | **Доработать** → Video Center |
| Video RTSP + FFmpeg bridge | Частично | probe/bridge/frame | Lab RTSP NOT_RUN | **Доработать** |
| Video WebRTC | Незавершённый | Signaling-only / не media | Не PASS | **Скрыть** до реализации |
| Walksnail | Частично | Режим вывода + reuse VideoPanel | Capture HW NOT_RUN | **Объединить** → Видео |
| Archive / recordings | Частично | SQLite clips + list | OK metadata | **Объединить** → Видео / События |
| MapLibre | Реально работающий | OSM/offline/XYZ, маркеры, az line | Packaged worker warning | **Сохранить** → Карта и планирование |
| Stations (Station Planner UI) | Частично | CRUD + AMSL | Нет complex/site UI | **Доработать** |
| Terrain Engine | Частично | GeoTIFF sample, linear profile | DEM зависит от файла | **Доработать** / внутри Карты |
| Pan-Tilt | Частично | Sim / Monitor / Local Status shell | Нет адаптера телеметрии | **Доработать** (без remote actuators) |
| Telemetry | Частично | Normalize + list/append SQLite | Live serial NOT_RUN | **Доработать** → Telemetry Center |
| Inventory | Частично | CRUD + maintenance | Нет привязки к станции | **Доработать** |
| Reports | Частично | JSON summary + minimal PDF | OK | **Перенести** → События / Advanced |
| Profiles | Частично | Import/presets комплексов | Путаница с `complexes` table | **Объединить** → Комплексы |
| Plugins | Частично | JS manager, deny list | Нет native sandbox | **Перенести в Advanced** |
| Remote / Gateway Preview | Частично | Token sync, outbox retry, enc secret (1.0.1) | Preview | **Перенести в Advanced** |
| Robotics | Незавершённый | Policy shell only | Нет | **Скрыть** |
| Aerial | Незавершённый | Observer shell, no pilot | Нет | **Скрыть** (логика → Телеметрия) |
| Settings | Частично | Users, JSON, gateway bits | OK | **Доработать** (Basic / Advanced) |
| Dashboard / Главная | Отсутствует | — | — | **ADD** (см. UX doc) |
| Complex / Site Manager UI | Таблицы есть, UI нет | `complexes`, `station_sites` | — | **ADD** |
| Mast / Antenna catalogs UI | Таблицы stub | `mast_profiles`, `antenna_profiles` | — | **ADD** |
| Unified status dictionary | Дублирование | Device vs Video vs PanTilt | — | **REWORK** |
| Event Center (full) | Частично | event_log + prune (1.0.1) | Нет UI filter/export полного | **Доработать** |

---

## 3. SQLite: существующие сущности (не дублировать)

| Таблица | Использовать как |
|--------|------------------|
| `complexes` | Complex Manager |
| `station_sites` | Site Manager (нужен `complex_id` — см. schema plan) |
| `stations` | Station Core / Planner |
| `mast_profiles` | Mast catalog |
| `antenna_profiles` | Antenna catalog |
| `terrain_sources` / `terrain_profiles` | Terrain |
| `equipment_inventory` / `maintenance_records` | Inventory |
| `devices`, `video_sources`, `recordings` | Device / Video |
| `telemetry_records` | Telemetry history |
| `event_log`, `audit_log` | Event Center |
| `profiles`, `workspace_layouts` | Workspace / legacy profiles |
| `settings_kv`, `kv_json`, `users` | Settings / auth |
| `sync_outbox` | Gateway Advanced |
| `network_nodes`, `diagnostic_reports` | Diagnostics |

Schema version **4** (док `SCHEMA.md` устарел — пишет 2).

---

## 4. Backend commands — переиспользование

Подтверждено в `src-tauri/src/lib.rs`:  
`auth_*`, `serial_*`, `list_usb_devices`, `list_network_interfaces`, `probe_host`, `video_*` / RTSP bridge, `terrain_*`, `gateway_*`, `db_*`, `station_*`, `inventory_*`, `maintenance_*`, `telemetry_*`, `report_complex_*`.

**Нет** dedicated: `complex_*`, `site_*`, `mast_profile_*`, `antenna_profile_*`, disk free space, unified dashboard aggregate (кроме `report_complex_summary`).

---

## 5. Frontend — переиспользование

| Компонент / сервис | Переиспользовать |
|--------------------|------------------|
| `DeviceManager` | Единый центр устройств |
| `PanelHost` / workspace panels | Раскладки |
| `MapPanel` + `mapStyles` | Карта и планирование |
| `StationsPanel` / AMSL helpers | Карточка станции |
| `TerrainPanel` / `terrainEngine` | Профиль рельефа |
| `VideoPanel` + adapters + FFmpeg | Video Center |
| `PanTiltPanel` | Monitor (expand) |
| `StatusBadge`, `ModuleErrorBoundary` | Общий UX |
| `eventBus` + `eventLogStore` | Event Center |
| Auth store / permission matrix | Роли |

---

## 6. Зависимости и риски регрессий

```
Auth ──► все write paths
SQLite ◄── stations, inventory, events, gateway, workspace hydrate
DeviceManager ◄── serial, usb, video, walksnail, network
Video ◄── FFmpeg bridge, MediaDevices, archive recordings
Map ◄── stations list (markers)
Terrain ◄── stations (profile endpoints)
Workspace ◄── PanelHost kinds
Gateway ◄── settings_kv, sync_outbox, auth
```

Риски при реструктуризации навигации: сломать deep-links `ModuleId`, Playwright сценарии, workspace `PanelKind`, права Observer, hydrate snapshot устройств.

---

## 7. Аппаратный статус (честно)

По post-release / HW lab docs: автоматизированные suite зелёные; **полевые COM/UVC/RTSP/HID/Walksnail** в основном NOT_RUN / BLOCKED; UVC на одной машине — FAIL (permission).  
**Не помечать** эти пути как «работающие» в продуктовом UI до lab PASS.

---

## 8. Критерий GS-0 (аудит)

- [x] Репозиторий изучен  
- [x] Функциональность инвентаризирована  
- [x] Таблица модулей с решениями  
- [x] Код не изменён ради GS-0  

*Конец Product Audit.*
