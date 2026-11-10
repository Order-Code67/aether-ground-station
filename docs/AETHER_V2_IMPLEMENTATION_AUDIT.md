# Aether Ground Station — Аудит соответствия ТЗ V2.0

**Дата аудита:** 2026-11-11  
**Репозиторий:** https://github.com/Order-Code67/aether-ground-station  
**Локальный путь:** `D:\Aether-Ground-Station`  
**Фактическая версия кода:** 0.4.0  
**Документ ТЗ:** AETHER GROUND STATION V2.0 (полное ТЗ для Cursor Agent)  
**Режим аудита:** без массовых правок кода, без удаления, без push в GitHub

---

## 1. Краткий вердикт

Проект — **рабочая модульная основа** (Operator Desktop + частичное ядро), а не пустой каркас.  
Стек в целом совпадает с целевым. Сборка frontend и `cargo check` проходят. Критичные smoke-проверки скриптом — OK.

Относительно ТЗ V2.0 готовность оценивается как **~25–35%** от целевого объёма:

| Область | Оценка |
|---------|--------|
| Каркас UI / навигация / error boundaries | Высокая |
| Device Manager / COM / USB / сеть (локально) | Средняя |
| Video (UVC) / Walksnail / запись на диск | Средняя (RTSP/WebRTC — заготовки) |
| Map / telemetry / workspace constructor | Средняя (без DEM, Station Planner, PX4/Ardu) |
| SQLite / auth / remote API stubs | Частичная |
| Station Planner, Terrain, Mast, Antenna, Pan-Tilt, Multi-Complex, Inventory, Reports, Plugins, Server/PostgreSQL | **Отсутствует** |
| Vitest / Playwright / Rust unit tests / Permission Engine на backend | **Отсутствует / слабо** |

**Вывод:** не пересоздавать проект. Развивать текущий репозиторий по этапам ТЗ §44, начиная со стабилизации Core + схемы SQLite, не трогая работающие COM/USB/MediaDevices без причины.

---

## 2. Фактическая архитектура

```
Operator Desktop (Tauri 2 + React 19)
├── AppShell: NavRail · TopBar · WorkArea · DeviceRail · EventLog · StatusBar
├── Login gate (Administrator / Operator / Observer)
├── ModuleErrorBoundary (shell / modules / panels)
├── Zustand stores + частичный SQLite sync (kv_json)
└── Services: deviceManager, eventBus, video adapters, telemetry normalize,
              network monitor, remote sandbox/stub, hardware invoke

Rust backend (src-tauri)
├── hardware: serial · usb · ethernet (probe)
├── database/sqlite: migrate CREATE IF NOT EXISTS + commands
├── video/mod.rs: заглушка под будущий FFmpeg
└── network/mod.rs: модуль-заготовка
```

**Нет отдельных процессов/сервисов:** Central Server, Remote Gateway runtime, PostgreSQL, FFmpeg Video Capture Service, Plugin host.

Маршрутизация — не React Router, а `navigationStore.activeModule` + `WorkArea` / `PanelHost`.

---

## 3. Структура существующих модулей UI

| ModuleId | Путь | Назначение сейчас |
|----------|------|-------------------|
| workspace | `src/modules/workspace` | Шаблоны, DnD колонок, вкладки layout, pin/unpin, сайдбар настроек панели |
| video | `src/modules/video` | MediaDevices + выбор адаптера RTSP/WebRTC |
| walksnail | `src/modules/walksnail` | Явный режим HDMI/USB capture → VideoPanel |
| map | `src/modules/map` | MapLibre: offline / local XYZ / OSM, метки, измерение |
| devices | `src/modules/devices` | Карточки из Device Manager |
| network | `src/modules/network` | Интерфейсы + probe + Network Monitor |
| usb | `src/modules/usb` | Enumeration по разрешению |
| serial | `src/modules/serial` | COM list/open/TX + reconnect handler |
| telemetry | `src/modules/telemetry` | JSON ESP32/Arduino → normalize + CSV |
| archive | `src/modules/archive` | Клипы сессии / пути на диске |
| profiles | `src/modules/profiles` | Профили комплексов + пресеты + import/export |
| remote | `src/modules/remote` | Режимы disabled/sandbox/integration + stub API |
| settings | `src/modules/settings` | Info, папка архива, backup SQLite |

**Отсутствующие модули ТЗ V2.0 (нет каталогов/экранов):**  
Station Planner · Terrain Engine · Mast · Antenna Geometry · Station Orientation · Pan-Tilt · Placement Analysis · Ground Station Manager · Multi-Complex · Robotics · Aerial · HID Controllers · Site Manager · Equipment Inventory · Maintenance · Power · Environment · Storage Manager · Reports · Plugin Manager · Diagnostics Manager · Time Sync UI.

---

## 4. Зависимости (факт)

### Frontend (`package.json`)

| Пакет | Назначение | Соответствие ТЗ |
|-------|------------|-----------------|
| tauri 2 / plugins dialog, fs, opener | Desktop | OK |
| react 19, typescript, vite, tailwind 4, zustand | UI | OK |
| maplibre-gl | Карты | OK |
| lucide-react | Иконки | OK (не в ТЗ явно) |
| **vitest** | — | **MISSING** |
| **playwright** | — | **MISSING** |
| WebRTC/FFmpeg npm-клиенты | — | нет (ожидаемо до Video Service) |

### Backend (`Cargo.toml`)

| Crate | Соответствие |
|-------|--------------|
| tauri 2, rusqlite (bundled), serialport, nusb, if-addrs, sha2, directories | OK для локального этапа |
| FFmpeg bindings | **MISSING** |
| PostgreSQL client | **MISSING** (сервер — отдельный этап) |

Массовое обновление зависимостей **не рекомендуется** без отдельной совместимостной проверки.

---

## 5. Результаты сборки и тестов

| Проверка | Результат | Комментарий |
|----------|-----------|-------------|
| `npm run typecheck` | **PASS** | |
| `npm run build` (tsc + vite) | **PASS** | Предупреждение: JS chunk ~1.4 MB |
| `npm run test:critical` | **PASS** | 5 проверок структуры/валидации (не поведение UI) |
| `cargo check` | **PASS** | |
| Vitest / Playwright / `cargo test` suite | **MISSING** | Нет в проекте |
| Полный `tauri build` / NSIS в ходе аудита | **не прогонялся** | Конфиг NSIS есть (`tauri.conf.json`); ранее собирался 0.4.0 |

---

## 6. Backend / SQLite

### Есть таблицы

`profiles`, `workspace_layouts`, `event_log`, `archive_clips`, `settings_kv`, `devices`, `video_sources`, `recordings`, `users`, `audit_log`, `kv_json`

### Проблемы относительно ТЗ §34

| Требование | Статус |
|------------|--------|
| Миграции | **PARTIAL** — один `CREATE IF NOT EXISTS`, нет `schema_version` / версионированных миграций |
| Индексы | **MISSING** |
| Внешние ключи | **MISSING** |
| Сущности stations / masts / antennas / terrain / complexes / inventory / … | **MISSING** |
| Dual-write | **NEEDS_REFACTOR** — Zustand `persist` (localStorage) + `useSqliteSync` в `kv_json`; таблицы `profiles`/`workspace_layouts` используются неполно |

### Auth / Security

- Локальный вход + sha2 hash пароля — **PARTIAL / READY для MVP**.
- Роли и `ROLE_PERMISSIONS` на frontend — есть.
- `useAuthStore.can()` **нигде не вызывается** → права UI не enforced.
- Проверка прав на Rust commands — **MISSING** (критично по ТЗ §32).
- Сессия в `kv_json` — упрощённо; не production-grade.

---

## 7. Статусы по подсистемам ТЗ (READY / PARTIAL / BROKEN / MISSING / NEEDS_REFACTOR)

### Ядро и каркас

| ID | Подсистема | Статус | Комментарий |
|----|------------|--------|-------------|
| A1 | Operator Desktop shell | **PARTIAL** | Есть; layout ≠ целевой «карта в центре + Station Planner» |
| A2 | ModuleErrorBoundary | **READY** | Shell / module / panel |
| A3 | Event Bus | **PARTIAL** | Generic severity+source; нет типизированных Domain Events (§35) |
| A4 | Device Manager | **PARTIAL** | Online/Offline/Lost/…; нет `Reconnecting`; типы устройств неполны |
| A5 | Capability Registry | **MISSING** | capabilities[] на карточке — не реестр |
| A6 | Configuration Manager | **PARTIAL** | settings_kv / UI настроек минимальны |
| A7 | Plugin Manager | **MISSING** | docs/PLUGINS.md только |
| A8 | Permission Engine | **PARTIAL** | Frontend map; backend нет; UI не применяет |
| A9 | Safety Monitor | **MISSING** | |
| A10 | Diagnostics Manager | **MISSING** | Частично event log |
| A11 | Workspace Manager | **PARTIAL** | DnD HTML5, вкладки, pin; нет мультимонитора / полного designer |
| A12 | Multi-Complex Manager | **MISSING** | Profiles ≈ заготовка комплексов |
| A13 | Session Manager | **PARTIAL** | Локальная auth session |
| A14 | Storage Manager | **PARTIAL** | Папка архива + recordings; нет DEM/docs/quota UI |
| A15 | Notification Manager | **MISSING** | Только event log |
| A16 | Update Manager | **MISSING** | docs/RELEASE упоминает план |

### Видео / телеметрия / карта / сеть

| ID | Подсистема | Статус | Комментарий |
|----|------------|--------|-------------|
| V1 | Video Engine (UVC/HDMI via MediaDevices) | **PARTIAL** | Реальный захват; нет multi-channel orchestrator |
| V2 | Walksnail adapter | **PARTIAL** | Явный режим; ошибки «нет устройства/сигнала» |
| V3 | RTSP / WebRTC / IP Camera | **PARTIAL** | Адаптеры с явными ошибками; потока нет |
| V4 | FFmpeg Video Capture Service | **MISSING** | `src-tauri/src/video/mod.rs` — комментарий |
| V5 | Disk recording + SQLite metadata | **PARTIAL** | save dialog + `recordings`; archive store дублирует |
| T1 | Telemetry normalize + CSV | **PARTIAL** | ESP32/generic JSON; нет PX4/ArduPilot/робототехники |
| T2 | Telemetry history DB | **MISSING** | История только in-memory |
| M1 | MapLibre base + offline/local/OSM | **PARTIAL** | |
| M2 | Satellite / topo / DEM layers | **MISSING** | Кнопка «Рельеф» — hint |
| M3 | Tracks / station domain markers | **MISSING** | User markers ≠ stations |
| N1 | Network Manager / Monitor | **PARTIAL** | Без автоскана — OK по ТЗ |
| R1 | Remote API contracts + stub | **PARTIAL** | Нет Central Server / Gateway runtime |

### Модули V2 «станции / рельеф / механика»

| ID | Подсистема | Статус |
|----|------------|--------|
| S1 | Station Planner | **MISSING** |
| S2 | Terrain Engine + DEM/GeoTIFF | **MISSING** |
| S3 | Mast Configuration | **MISSING** |
| S4 | Antenna Geometry | **MISSING** |
| S5 | Station Orientation on map | **MISSING** |
| S6 | Pan-Tilt Manager (Sim/Monitor/Local) | **MISSING** |
| S7 | Placement analysis compare | **MISSING** |
| S8 | Ground Station Manager | **MISSING** (profiles частично) |
| S9 | Site Manager | **MISSING** |
| S10 | Equipment Inventory | **MISSING** |
| S11 | Maintenance Manager | **MISSING** |
| S12 | Power / Environment monitoring | **MISSING** |
| S13 | Robotics Manager | **MISSING** |
| S14 | Aerial Systems Manager | **MISSING** |
| S15 | HID / Physical controllers | **MISSING** |
| S16 | Reports Manager (PDF/CSV/JSON) | **MISSING** (CSV телеметрии есть) |
| S17 | Time Synchronization | **MISSING** |

### Качество / выпуск

| ID | Подсистема | Статус |
|----|------------|--------|
| Q1 | Vitest / component tests | **MISSING** |
| Q2 | Playwright scenarios A–E | **MISSING** |
| Q3 | Rust unit tests | **MISSING** |
| Q4 | critical-path script | **PARTIAL** | Не поведенческие тесты |
| Q5 | NSIS installer config | **PARTIAL** | Готов к сборке; подпись/updater — нет |
| Q6 | Docs adapters/remote/release | **PARTIAL** | Нет docs по Station/Terrain |

---

## 8. Что уже работает (не ломать без причины)

1. Tauri 2 + React 19 shell, тёмная тема, модульная навигация.
2. `ModuleErrorBoundary` на уровнях оболочки / модуля / панели.
3. Реальные COM / USB / локальные NIC + TCP probe (с согласием пользователя).
4. `deviceManager` + статусы + reconnect hooks + снимок в SQLite.
5. MediaDevices UVC/HDMI preview и запись на диск через dialog/fs.
6. Walksnail: запрет старта без явного режима вывода.
7. MapLibre с офлайн-базой и локальными XYZ.
8. Нормализация телеметрии без подстановки фиктивных чисел.
9. Локальный login + hash пароля admin.
10. Принцип «нет mock video/devices» в существующих модулях.
11. Remote API types + sandbox/stub без канала пилотирования.
12. Воспроизводимая frontend-сборка и `cargo check`.

---

## 9. Что работает частично

- Workspace DnD (HTML5) — не полный Workspace Designer / multi-monitor.
- Video adapters RTSP/WebRTC — только ошибки «сервис не готов».
- SQLite SSOT — параллельно localStorage persist.
- Auth roles — не применяются в UI/backend commands.
- Profiles / complex presets — не Station/Complex domain model V2.
- Archive — сессионные object URL + путь; нет полноценного Storage Manager.
- Event bus — не domain-typed events.
- Network monitor — только явно добавленные хосты (это правильно), но нет богатой модели узлов ТЗ §21.
- Remote — нет реального Gateway/Server.

---

## 10. Что сломано / технические долги (не «падение сборки»)

| # | Проблема | Риск |
|---|----------|------|
| 1 | Права ролей не enforced (`can()` не используется) | Security / ТЗ §32 |
| 2 | Нет версионированных миграций SQLite, FK, индексов | Целостность данных V2 |
| 3 | Dual persistence localStorage ↔ SQLite | Рассинхрон профилей/workspace |
| 4 | DeviceStatus без `Reconnecting` | Неполное соответствие §5 |
| 5 | Таблицы `devices`/`profiles` в SQL vs данные в `kv_json` | Дублирование сущностей |
| 6 | Крупный frontend bundle (~1.4 MB) | Производительность |
| 7 | Settings показывает устаревший fallback version/stage | UX/поддержка |
| 8 | Нет backend ACL на invoke commands | Security |
| 9 | Тесты critical-path не проверяют поведение | Ложная уверенность |
| 10 | FFmpeg / DEM / Station domain отсутствуют при ожиданиях V2 | Gap продукта |

**BROKEN в смысле «не компилируется»:** на момент аудита **не обнаружено**.

---

## 11. Чего не хватает (приоритет для V2.0)

**P0 (фундамент перед новыми доменами):**  
версионированные миграции SQLite · единый SSOT · Permission Engine (UI+Rust) · типизированный Event Bus · Diagnostics Manager skeleton · Vitest на критичных stores.

**P1 (ТЗ этапы 2–4):**  
Workspace Designer доработка · Video Capture Service (FFmpeg) · Map Engine расширения (слои, треки).

**P2 (этапы 5–6 — ядро V2 дифференциации):**  
Station Planner · Mast/Antenna · Orientation · Terrain Engine (DEM/GeoTIFF/profile) · Placement compare.

**P3 (этапы 7–8):**  
Telemetry adapters PX4/Ardu · Ground Station / Site / Inventory / Maintenance / Power / Env · Pan-Tilt Sim/Monitor.

**P4 (этапы 9–11):**  
Remote Gateway+Server (PostgreSQL) · Plugins · Reports · Playwright A–E · signed NSIS + updater docs.

---

## 12. Что не следует трогать без обоснования

- Реализацию `serialport` / `nusb` / `if-addrs` probe.
- MediaDevices capture path, пока нет FFmpeg-сервиса на замену.
- `ModuleErrorBoundary` и принцип изоляции панелей.
- Запрет автоскана чужих сетей.
- Политику «null / N/A вместо фиктивных данных».
- Remote: отсутствие канала пилотирования / боевых команд.
- Существующие имена `ModuleId` — расширять, не ломать без миграции UI.

---

## 13. Критические технические риски

1. **Расширение схемы SQLite без миграций** → поломка существующих установок 0.4.0.
2. **Station/Terrain без чётких единиц AMSL** → ошибки высот (ТЗ §9.3 жёстко требует разделения).
3. **Pan-Tilt «удобные кнопки»** → риск нарушить границу безопасности §14 (удалённое управление исполнительными механизмами запрещено).
4. **Подмена DEM/радиопрогноза** → запрещено ТЗ; нужен явный UX «нет данных».
5. **Permission только в UI** → Observer сможет вызвать Tauri commands.
6. **Одновременный localStorage + SQLite** → потеря данных при «источнике правды».

---

## 14. Сопоставление с критериями готовности V2.0 (§47)

| Критерий | Сейчас |
|----------|--------|
| Сборка Windows 11 x64 | Да (dev/check); installer config есть |
| Существующие функции сохранены | Да |
| Изоляция модулей / error boundary | Да |
| SQLite + миграции | Частично (нет versioned migrations) |
| Реальные статусы устройств | Частично |
| Видео с реальными источниками | UVC да; RTSP/WebRTC нет |
| Записи на диск + открытие | Частично |
| Карты + offline | Частично |
| Размещение станций / высоты / мачты / азимут | **Нет** |
| DEM + terrain profile | **Нет** |
| Pan-Tilt Sim/Monitor | **Нет** |
| Несколько комплексов | Заготовка профилей |
| Инвентаризация | **Нет** |
| Журналы | Частично |
| Workspace save | Частично |
| Права пользователей | Слабо |
| Backup | Частично (`db_backup`) |
| Сценарии A–E тестами | **Нет** |
| Документация V2 доменов | **Нет** |
| Установщик | Конфиг/ранее собран; не критерий «подписан» |

---

## 15. Рекомендуемый поэтапный план (кратко)

См. детально: [`AETHER_V2_IMPLEMENTATION_ROADMAP.md`](./AETHER_V2_IMPLEMENTATION_ROADMAP.md).

1. **Этап 0 (этот документ)** — аудит ✓  
2. **Этап 1 Core** — schema_version migrations, SSOT, permissions backend+UI, typed events, diagnostics skeleton, DeviceStatus `Reconnecting`, тесты stores  
3. **Этап 2 Workspace** — довести DnD/resize/profiles; не ломать текущие templates  
4. **Этап 3 Video** — FFmpeg service + реальные RTSP; Walksnail оставить на capture  
5. **Этап 4 Maps** — слои, треки, привязка к domain stations  
6. **Этап 5–6** — Station Planner + Terrain (главный объём V2)  
7. **Этап 7–8** — Telemetry adapters + GSM/Site/Inventory/Pan-Tilt  
8. **Этап 9–11** — Remote infra, plugins/security, release tests/NSIS  

**Запрещено до согласования:** массовая генерация всех MISSING модулей одним PR.

---

## 16. Затрагиваемые зоны при Этапе 1 (preview файлов)

При согласовании Этапа 1 ожидаемо:

- `src-tauri/src/database/sqlite.rs` — versioned migrations  
- `src/hooks/useSqliteSync.ts`, stores persist — SSOT  
- `src/types/auth.ts`, layout/nav guards, Rust command ACL  
- `src/services/events/*` — domain events  
- `src/types/devices.ts` — `Reconnecting`  
- `package.json` — vitest (точечно)  
- Новые docs: schema, permissions  

Не удалять модули `video`/`serial`/`usb`/`map`/`workspace`.

---

## 17. Итоговая матрица готовности модулей UI

| Модуль | Статус V2 |
|--------|-----------|
| workspace | PARTIAL |
| video | PARTIAL |
| walksnail | PARTIAL |
| map | PARTIAL |
| devices | PARTIAL |
| network | PARTIAL |
| usb | PARTIAL → ближе к READY для enumeration |
| serial | PARTIAL → ближе к READY для COM I/O |
| telemetry | PARTIAL |
| archive | PARTIAL |
| profiles | PARTIAL |
| remote | PARTIAL |
| settings | PARTIAL |
| station-planner / terrain / pan-tilt / … | MISSING |

---

*Конец аудита. Ожидается согласование roadmap перед реализацией.*
