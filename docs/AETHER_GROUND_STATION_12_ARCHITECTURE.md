# Aether Ground Station — Architecture 1.2 (GS-1)

**Документ:** `AETHER_GROUND_STATION_12_ARCHITECTURE.md`  
**Задача:** TASK 1.2 — Advanced Ground Station & Station Planner  
**Этап:** GS-1 (аудит + план; без реализации кода)  
**Дата:** 2026-11-11  
**База кода:** ветка `release/1.0.1-validation` (поверх 1.0.0 / schema v1–4)  
**Ограничения:** без новой архитектуры приложения; без remote pilot / remote actuators; Pan-Tilt = Simulation / Monitoring / Local Device Status only; schema change только с обоснованием; без push/publish без согласования.

---

## 1. Цель документа

Зафиксировать **что уже есть** в Map / Station Planner / Terrain / GS Manager / Device / Pan-Tilt / Inventory / SQLite / stores / UI / tests, и **как расширять** до целевой модели 1.2.0 **без дублирующих таблиц, сервисов и параллельного SSOT**.

Целевой релиз **1.2.0** — feature train поверх утверждённого 1.0.x (reliability). Не смешивать с открытыми P0 поля 1.0.1 (VID/MAP/HW lab), кроме явной зависимости.

---

## 2. Текущий стек и слои (сохранить)

```
UI modules (React) + PanelHost / Workspace Designer
        ↓
Zustand (auth, workspace, devices, events, …) + module-local state
        ↓
Services (stations, terrain, inventory, deviceManager, …)
        ↓
Tauri commands (Rust) → SQLite SSOT (rusqlite, schema_migrations v4)
```

Стек: **Tauri 2 · React 19 · Zustand · MapLibre · SQLite**. Не заменять MapLibre, не вводить второй БД, не выносить Station Planner в отдельное приложение.

---

## 3. Аудит: что уже реализовано

### 3.1 SQLite / SSOT (schema v4)

Источник: `src-tauri/src/database/migrations.rs`.  
`docs/SCHEMA.md` **устарел** (пишет «Current: 2») — фактическая версия **4**.

| Таблица (v2+) | Назначение | CRUD backend | UI |
|--------------|------------|--------------|-----|
| `complexes` | Комплексы | **нет** dedicated cmds | **нет** |
| `station_sites` | Площадки | **нет** | **нет** |
| `stations` | Станции + AMSL + az/el/tilt | `station_list/upsert/delete` | StationsPanel |
| `mast_profiles` | Каталог мачт | **нет** | **нет** |
| `antenna_profiles` | Каталог антенн | **нет** | **нет** |
| `terrain_sources` | Реестр DEM | `terrain_register_source` | TerrainPanel (частично) |
| `terrain_profiles` | Сохранённые профили | **нет** list/upsert | in-memory UI only |
| `equipment_inventory` | Инвентарь | `inventory_*` | InventoryView |
| `maintenance_records` | ТО | `maintenance_*` | InventoryView |
| `devices` / `telemetry_records` | Device Manager / телеметрия | sqlite + DeviceManager | Devices / Telemetry |
| `diagnostic_reports` | Диагностика | partial | Telemetry |
| `sync_outbox` (+v3/v4 attempts) | Gateway outbox | gateway cmds | Remote |

**Вывод:** сущности TASK §15 в основном **уже заложены в v2**. Не создавать параллельные `station_sites_v2` / второй inventory. Расширять существующие таблицы + добавить **только недостающие** связи.

### 3.2 Ground Station Core / Station Planner

| Элемент | Статус |
|---------|--------|
| id, name, lat/lng, site_id, complex_id | Есть в `stations` / `Station` TS |
| terrain / mast / offset / antenna_center_amsl | Есть; формула в Rust + TS |
| AMSL = NULL при отсутствии terrain | **Соблюдено** (unit + e2e formula) |
| description, created_at, status | **Нет** отдельных колонок (есть `notes` / `payload`) |
| Валидация координат | **Слабая** (нет clamp lat/lng на backend) |
| mast unknown → не подставлять 0 | **Нарушено схемой:** `mast_height_m REAL NOT NULL DEFAULT 0`; UI create ставит `10` |
| UI complex/site binding | **Нет** (поля в модели, UI не редактирует) |
| Карточка станции | Базовая форма (имя, coords, heights, azimuth) |
| История изменений | **Нет** (только `updated_at` + domain events в event_log) |

Файлы: `database/stations.rs`, `services/stations/index.ts`, `modules/stations/StationsPanel.tsx`.

### 3.3 Map Engine

| Возможность | Статус |
|-------------|--------|
| MapLibre + OSM / offline / local XYZ | Есть (`mapStyles`, MapPanel) |
| Маркеры станций из SQLite | Есть |
| Азимут: линия GeoJSON + rotation маркера | Есть (упрощённо, ~2 км cue) |
| Popup AMSL / az | Есть |
| Drag-move станции → save SQLite | **Нет** |
| Маркеры площадок / multi-select / слои высот | **Нет** |
| Выбор 2 точек для Terrain Profile | Measure mode есть; **не связан** с Terrain Engine |

Файлы: `modules/map/MapPanel.tsx`, `mapStyles.ts`, `docs/MAP_OFFLINE_XYZ.md`.

### 3.4 Terrain Engine

| Возможность | Статус |
|-------------|--------|
| Empty / manual / GeoTIFF adapters (TS) | Есть |
| Rust GeoTIFF inspect + sample | Есть (strip, Deflate/Zlib, Float32/Int16 path) |
| Tiled GeoTIFF | Частично / по мере поддержки парсера — **документировать границы** |
| Регистрация `terrain_sources` | Есть |
| Linear profile N/A-safe | Есть (`buildLinearProfile`) |
| Выбор A–B на карте + export + persist `terrain_profiles` | **Нет** |
| Разделение raw / processed / map tiles / sampled values | Meta частично; **нет явной модели стадий** |
| Vertical datum mix guard | Поле `vertical_datum` в таблице; **нет преобразования** |

Файлы: `src-tauri/src/terrain/mod.rs`, `services/terrain/terrainEngine.ts`, `modules/terrain/TerrainPanel.tsx`.

### 3.5 Site / Multi-Complex Manager

Таблицы есть. **Нет** Tauri commands, frontend services, UI, фильтрации, guard «чужой комплекс», документов/фото, статуса площадки, истории.

`station_sites` **не имеет** `complex_id` FK — связь только через `stations.complex_id` / `stations.site_id` (площадка формально независима от комплекса).

### 3.6 Mast & Antenna Manager

Таблицы `mast_profiles` / `antenna_profiles` — каталог-заготовки.  
Станция хранит **скаляры** `mast_type`, `mast_height_m`, `antenna_type`, один `azimuth_deg` — не multi-antenna mounts.

Нет: типов мачт как enum UI, уровней крепления, beamwidth sector на карте, каталога с N/A-полями, many-to-many mounts.

### 3.7 Antenna Geometry

Частично на карте (линия азимута). Нет разделения geographic az / mechanical install / tilt / horizon; нет source/quality/timestamp азимута; нет sector HPBW без выдуманных параметров.

### 3.8 Pan-Tilt Status

`PanTiltPanel`: Simulation / Monitoring / Local Device Status.  
Simulation — виртуальные слайдеры. Monitoring — N/A без адаптера (без fake stream). **Нет** remote actuator commands — сохранить.

Связь с `stations.pan_tilt_status` / `elevation_deg` / `tilt_deg` — **не связана** с панелью.

### 3.9 Equipment / Device Manager

- **Inventory:** CRUD list/upsert; `location` text; **нет** `station_id` / `complex_id`.
- **Device Manager:** единый реестр устройств (COM/USB/…), snapshot в `kv_json`/`devices`; reconnect handlers.
- Не дублировать каталог: привязка = FK/junction к `equipment_inventory` + опционально device card id в payload.

### 3.10 Zustand / Workspace UI

Stores: `authStore`, `workspaceStore`, `deviceStore`, `eventLogStore`, `navigationStore`, `profileStore`, `archiveStore`, `appStore`.  
**Нет** `stationStore` / `complexStore` — станции живут в local `useState` панелей → риск рассинхрона Map ↔ Stations ↔ Terrain.

Workspace: `PanelKind` уже включает `stations` | `terrain` | `pantilt` | `map`.  
NavRail: modules `stations`, `terrain`, `pantilt`, `inventory`.  
Интегрировать 1.2 в **существующий** Workspace Designer (левая иерархия / карта / правая карточка / нижний профиль) — расширением layout template, не отдельным shell.

### 3.11 Тесты (база для расширения)

| Слой | Есть | Пробелы 1.2 |
|------|------|-------------|
| Rust | AMSL formula; DEM GeoTIFF fixtures | CRUD complex/site; migration v5; coord/height validation; backup |
| Vitest | AMSL; mapStyles; contracts | station store; azimuth geometry; site filter |
| Playwright | station AMSL formula / partial CRUD UI | complex→site→station flow; restart reload; mast/antenna |

---

## 4. Gap matrix (TASK 1.2 ↔ код)

| Требование TASK | Сейчас | Действие 1.2 |
|-----------------|--------|--------------|
| Multi-complex | Таблица only | GS-2: CRUD + filter + write guard |
| Site Manager | Таблица only | GS-2: CRUD + site↔complex link |
| Station Core fields | ~70% | GS-3: soft columns / payload policy; fix mast NULL semantics |
| Station Planner map UX | Markers + az line | GS-3: select/move/edit, site markers |
| Mast Manager | Table stub | GS-4: cmds + UI; link profile → station |
| Antenna catalog + multi-mount | Table stub + single az on station | GS-4/5: mounts table |
| Antenna geometry quality | Basic line | GS-5 |
| Pan-Tilt monitor expand | UI shell | GS-5/8: bind telemetry display only |
| Terrain sources meta | Partial | GS-6 |
| Terrain Profile A–B + export | Linear demo | GS-7 |
| Equipment ↔ station | Decoupled | GS-8 |
| Station comparison A/B/C | Missing | GS-9 + `station_placement_scenarios` |
| History | event_log only | Soft: `entity_revisions` or audit_log reuse — обосновать v5 |
| Workspace 4-pane GS layout | Panels exist separately | GS-3/10: template «Station Planner» |

---

## 5. Целевая доменная модель (расширение, не дубль)

```
Complex 1──* Site 1──* Station
                │         ├── optional MastProfile (ref)
                │         ├── * AntennaMount → AntennaProfile
                │         ├── * EquipmentAssignment → equipment_inventory
                │         └── pan-tilt status (monitor/sim fields)
DEM Source ──* samples / profiles (station or free A–B)
PlacementScenario *──* Station|Site snapshots (comparison)
```

### 5.1 Правила высот (обязательные)

1. `antenna_center_amsl_m` **только вычисляемое**; хранить отдельно от входных.
2. Если `terrain_elevation_m` IS NULL → AMSL = NULL (N/A).
3. Если высота мачты **неизвестна** → `mast_height_m` IS NULL (миграция: снять NOT NULL DEFAULT 0); UI не подставляет 0/10 молча.
4. Не смешивать AGL и AMSL в одном поле.
5. Метрика everywhere; coords validate (−90…90 / −180…180).
6. Не обещать RF range / link quality от геометрии профиля.

### 5.2 Pan-Tilt safety boundary

Разрешено: Simulation values, Monitoring of received telemetry, Local Device Status.  
Запрещено: remote move commands, servo handlers, actuator APIs over Remote/Gateway.

---

## 6. План схемы SQLite (предложение v5 — только с обоснованием)

**Принцип:** ALTER/расширение существующих таблиц; новые таблицы только если нет эквивалента.

| Изменение | Обоснование | Альтернатива без DDL |
|-----------|-------------|----------------------|
| `station_sites.complex_id` FK + index | Фильтрация multi-complex; изоляция записи | Только через stations — слабо для Site Manager |
| `stations.description`, `status`, `created_at`; `mast_height_m` → NULLABLE | TASK §3 | Класть в `payload` JSON — хуже для индексов/AMSL |
| `station_antenna_mounts` | Multi-antenna + geometry per mount | Дублировать в `payload` — dual model risk |
| `equipment_inventory.station_id` NULL FK **или** `station_equipment` junction | TASK §14 без второго каталога | `location` text — недостаточно |
| `station_placement_scenarios` | A/B/C comparison persist | Только files — вне SSOT |
| Опционально `entity_change_log` | История site/station | Переиспользовать `audit_log` с `event` taxonomy |

**Не создавать:** вторые `stations2`, отдельный inventory, параллельный KV SSOT для станций.

Миграция: `SCHEMA_VERSION = 5`; тесты apply 1→5 на temp DB + backup restore compatibility.  
Обновить `docs/SCHEMA.md` (сейчас drift v2 vs v4).

---

## 7. План сервисов и UI (без параллельных слоёв)

### 7.1 Backend commands (новые / расширить)

- `complex_list|upsert|delete`
- `site_list|upsert|delete` (+ filter by complex)
- `mast_profile_*`, `antenna_profile_*`
- `station_antenna_mount_*`
- `terrain_profile_list|upsert|delete` (+ export helper)
- `placement_scenario_*`
- Расширить `station_upsert`: validation, nullable mast, optional remount AMSL
- Inventory: assign/unassign station

Permissions: существующий `ManageDevices` / Observer write guard; filter writes by active complex context (app-level + SQL WHERE).

### 7.2 Frontend

- `services/complexes`, `services/sites` (тонкие invoke wrappers).
- `stores/stationPlannerStore` (complexId, siteId, selectedStationId, demMeta) — **один** координатор для Map/Stations/Terrain.
- UI: template Workspace «Station Planner»:
  - Left: Complex → Site → Station tree
  - Center: MapPanel (расширение)
  - Right: station card (mast/antennas/equipment tabs)
  - Bottom: Terrain Profile + events
- Не форкать MapPanel в Google-Maps-подобный UI; развивать MapLibre.

### 7.3 Этапы реализации (как в TASK §18)

| Stage | Scope | Exit criteria |
|-------|--------|---------------|
| **GS-1** | Этот документ | Accepted architecture |
| **GS-2** | Complex + Site CRUD, FK, filter, isolation | Multi complex/site e2e |
| **GS-3** | Station Planner map+card, nullable mast, sync store | Coords persist, AMSL rules |
| **GS-4** | Mast & Antenna profiles + mounts | Bind without inventing RF params |
| **GS-5** | Antenna geometry + Pan-Tilt monitor bind | Az on map; no actuators |
| **GS-6** | Terrain source meta / DEM pipeline clarity | Register + sample N/A-safe |
| **GS-7** | Profile A–B map pick, export, SQLite save | Disclaimer RF intact |
| **GS-8** | Equipment ↔ station; Device Manager link | Single inventory |
| **GS-9** | Placement scenarios A/B/C | SQLite scenarios |
| **GS-10** | Tests, SCHEMA.md, RELEASE notes 1.2.0 prep | Acceptance §19; **no push without OK** |

После каждого этапа: `typecheck`, relevant vitest/cargo, targeted e2e.

---

## 8. Тест-план (наращивание)

**Rust:** AMSL (уже); coord/height validation; complex/site/station FK; migration v5; mounts; backup.  
**Vitest:** planner store; site filter; azimuth geometry helpers; missing N/A UI helpers.  
**Playwright:** complex → site → station → move coords → mast/antenna → AMSL → reload.  
**Регрессия:** существующие station AMSL / auth / gateway / archive suites не ломать.

---

## 9. Вне scope 1.2.0

- Remote pilot / remote pan-tilt actuators / servo command paths  
- WebRTC media SFU, Authenticode, updater CDN (это 1.1.0 backlog)  
- Замена MapLibre / новая app shell  
- RF coverage prediction, «радиус связи», auto radio optimization  
- Google Hybrid Station Planner clone; Arduino pan-tilt HTML как product UI  
- Mass refactor Device Manager  

Открытые **1.0.1** field items (UVC permission, Map worker packaged) ведутся отдельно; 1.2 не блокируется ими для desktop-dev, но release 1.2.0 должен честно отражать HW coverage.

---

## 10. Рекомендуемый порядок первого кода (после approve GS-1)

1. Согласовать schema v5 минимальный набор (§6).  
2. GS-2 backend CRUD complexes/sites + tests.  
3. stationPlannerStore + UI tree.  
4. Затем GS-3 map interactions.

**Стоп-линия GS-1:** реализация кода GS-2+ не начинается до явного OK на этот документ / schema delta.

---

## 11. Сводка аудита (one-liner)

Каркас **уже в SQLite v2+ и панелях Stations/Map/Terrain/PanTilt/Inventory**; 1.2.0 — это **доведение CRUD, связей, Planner UX и тестов**, а не greenfield подсистемы.

---

*Конец GS-1 Architecture. Следующий шаг по TASK: GS-2 после согласования.*
