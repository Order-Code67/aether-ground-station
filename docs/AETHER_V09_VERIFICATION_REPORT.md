# Aether Ground Station — Verification Report 0.9.0

**Тип:** AUDIT ONLY (без массовых правок кода, без push)  
**Дата аудита:** 2026-11-11  
**Repository:** https://github.com/Order-Code67/aether-ground-station  
**Проверенный commit:** `0dda7b4` (`main`)  
**Заявленная версия:** 0.9.0 (`package.json`, `src-tauri/Cargo.toml`, `tauri.conf.json`)  
**Базовый отчёт релизов:** `docs/AETHER_V2_PROGRESS.md` + пользовательский отчёт о работах 0.5–0.9  

---

## 1. Вердикт

| Метрика | Оценка |
|---------|--------|
| Соответствие заявкам 0.9.0 (с учётом явно помеченных scaffold) | **~82%** — отчёт в целом честный |
| Подтверждённая готовность к **1.0.0** (production bar) | **~58%** |
| Критические блокеры 1.0.0 | Есть (security session bind, restore DB, HW/integration gaps, release unsigned) |

**Главный вывод:** продукт — рабочая модульная desktop-платформа с реальным SQLite SSOT, Station/AMSL math, UVC path, FFmpeg probe/bridge code, DEM sampler (ограниченные форматы) и ACL-заготовками. Ряд пунктов 0.9.0 — **scaffold** (WebRTC media, production Gateway/PG, updater plugin, Robotics/Aerial shells). Их нельзя считать READY для 1.0.0. Автотесты зелёные, но **не заменяют** интеграцию с железом / RTSP / DEM-файлами / Tauri WebView2 / NSIS.

---

## 2. Метод проверки

### Выполнено реально на машине аудита

| Проверка | Результат |
|----------|-----------|
| `git rev-parse HEAD` = `0dda7b4…` | OK |
| `npm run typecheck` | PASS |
| `npm test` (Vitest) | PASS — 8 tests / 4 files |
| `npm run test:critical` | PASS — 5 structural checks |
| `cargo test` | PASS — 5 tests (AMSL, TIFF×2, DEM float sample, PDF header) |
| `npm run test:e2e` | PASS — 5 Playwright (browser Vite) |
| `npm run test:e2e:tauri` | 2 **skipped** (нет `AGS_TAURI_URL`) |
| `npm run build` | PASS |
| Наличие `src-tauri/resources/bin/ffmpeg.exe` + `ffprobe.exe` | OK (локально; не в git) |
| Наличие `services/gateway-server/certs/*` | OK локально (gitignore) |
| `tauri-plugin-updater` в node_modules | **Отсутствует** |
| Статический разбор исходников A–J | Выполнен |

### Не выполнено (ограничения среды)

- `tauri build` / NSIS installer smoke  
- COM/USB/UVC/RTSP на реальном железе  
- Live RTSP bridge (нужен поток + FFmpeg runtime)  
- Live GeoTIFF файлы оператора (кроме synthetic unit fixture)  
- Live PostgreSQL + TLS handshake клиента desktop→gateway  
- Authenticode / CDN updater  
- Playwright против packaged WebView2  

---

## 3. Сверка заявлений 0.9.0 с фактом

| Заявление | Факт | Статус аудита |
|-----------|------|---------------|
| Bundled FFmpeg resolve + fetch script | Код `bundled_tool`/`resolve_tool`; скрипт `scripts/fetch-ffmpeg.ps1`; resources в conf; бинари локально | PARTIAL→READY code; release **NOT_VERIFIED** без tauri build |
| GeoTIFF tiled + Deflate | Реализовано в `terrain/mod.rs`; unit test только uncompressed float strip | PARTIAL |
| Gateway TLS + optional PG | Server stub поддерживает; desktop sync — raw HTTP TCP, не TLS client | PARTIAL (server) / PARTIAL (client) |
| Updater keys/example | Scripts + example JSON; **plugin не подключён** в runtime | PARTIAL scaffold |
| WebRTC relay signaling | `services/webrtc-relay` WS rooms; UI только hello+close | PARTIAL signaling only — **не video** |
| Robotics/Aerial/HID modules | UI shells, monitor-only | PARTIAL scaffold |
| e2e Tauri harness | Config + skipped tests без env | PARTIAL harness |

---

## 4. Оценка по направлениям

### A. Core / SQLite / SSOT — **PARTIAL**

**Файлы:**  
`src-tauri/src/database/migrations.rs` (v1–v3), `sqlite.rs`, `src/hooks/useSqliteSync.ts`, `src/stores/workspaceStore.ts`, `profileStore.ts`, `archiveStore.ts`

**Подтверждено:**
- Миграции versioned через `schema_migrations` (1→2→3), `CREATE IF NOT EXISTS`, идемпотентный повторный прогон по версии.
- Workspace/profiles: комментарий и код SSOT через `kv_json` + `useSqliteSync` (без localStorage dual-write).
- `db_backup` копирует `.sqlite` → `.sqlite.bak`.
- `db_init` / `open_and_migrate` при старте.

**Проблемы:**
- **Нет `db_restore`** — только backup copy; восстановление не автоматизировано.
- `archiveStore` всё ещё `zustand/persist` → **localStorage** (`ags-archive-v1`) — исключение из SSOT.
- `SCHEMA_VERSION` константа не используется (warning); нет жёсткой проверки «ожидаемая версия == фактическая» на UI.
- Нет тестов на повреждённую БД / отсутствие файла / race subscribe→upsert.
- FK объявлены в migrate_v2, но целостность при удалении комплексов/станций **не покрыта** интеграционными тестами.
- Session auth bind доверяет frontend (`auth_bind_session`) — см. H.

**Для READY:** restore API + тест миграций на temp DB; убрать/перевести archive на SQLite; corruption drill.

---

### B. Device Manager — **PARTIAL** / HW **NOT_VERIFIED**

**Файлы:**  
`src/services/devices/deviceManager.ts`, `src/types/devices.ts`, Serial/USB/Network panels, `src-tauri/src/hardware/*`

**Подтверждено (код):**
- Статусы: Online, Offline, Lost, Connecting, Reconnecting, Warning, Error, Unknown.
- `registerReconnectHandler` + переход Reconnecting→Online/Lost.
- COM: `serial_list_ports` / open / write / close + auth write guard.
- USB: `list_usb_devices` (nusb).
- MediaDevices: enumerate в video adapter.
- Critical-path: structural match на SerialPanel reconnect registration.

**Не подтверждено:**
- Реальное отключение COM/USB, зависания UI, утечки handles после crash FFmpeg/serial.
- Поведение после полного restart desktop с открытым портом.

**Риск:** reconnect логика in-memory; после restart handlers нужно регистрировать снова модулями.

---

### C. Video Engine — **PARTIAL**

**Файлы:**  
`src-tauri/src/video/mod.rs`, `src/services/video/*`, `src/modules/video/VideoPanel.tsx`, `src/types/video.ts`

| Подсистема | Статус | Доказательство |
|------------|--------|----------------|
| Bundled FFmpeg resolve | PARTIAL | Код есть; local bins OK; NSIS embed **NOT_VERIFIED** |
| PATH fallback | READY (code) | `resolve_tool` → `which` |
| ffprobe/ffmpeg probe RTSP | PARTIAL | Код + auth; live RTSP **NOT_VERIFIED** |
| UVC MediaDevices | PARTIAL | Код; железо **NOT_VERIFIED** |
| RTSP JPEG bridge start/stop/status/frame | PARTIAL | Полный lifecycle в Rust; нет unit/e2e на процесс; HW **NOT_VERIFIED** |
| Recording UVC → disk + SQLite metadata | PARTIAL | `recording.ts` + `db_upsert_recording`; RTSP bridge **не** пишет MediaRecorder |
| WebRTC | PARTIAL **signaling only** | Relay WS + adapter hello; **нет** SDP/ICE/MediaStream/SFU |

**Сигналы UI (`VideoSignalState`):** unknown, no-device, no-signal, ok, degraded, lost, recording, error.  
Отдельного enum-значения `Connecting` / `Streaming` нет — «Connecting» ближе к `unknown` при connect; streaming ≈ `ok`. **Неполное соответствие** чеклисту S1 wording, семантика покрыта частично.

**Проблемы:**
- Bridge: stderr piped но не читается → риск заполнения pipe / zombie на ошибках.
- Нет гарантии kill child при drop App (есть stop command; unmount вызывает stop).
- Poll JPEG без CRC/partial-write detection beyond SOI check.
- WebRTC **нельзя** маркировать как видеопоток.

---

### D. Map / Station Planner — **PARTIAL** / Map HW tiles **NOT_VERIFIED**

**Файлы:**  
`src/modules/map/MapPanel.tsx`, `mapStyles.ts`, `src/modules/stations/*`, `src/services/stations/*`, `src-tauri/src/database/stations.rs`

**Подтверждено:**
- MapLibre init, offline / local XYZ / OSM modes (код).
- Станции из `listStations()` → markers + GeoJSON азимутальные линии.
- CRUD станций + permission ManageDevices на upsert/delete.
- AMSL: `calcAntennaCenterAmsl` + Vitest + Rust unit `amsl_formula`.
- Null terrain → null AMSL / UI N/A.

**Проблемы / gaps:**
- Offline «без тайлов» — basemap без гарантии картографической полезности.
- OSM требует сеть — не проверено offline-first production.
- Азимут линия — визуальный cue (~0.02°), не geodetic rhumb/great-circle precision audit.
- Playwright e2e AMSL — **page.evaluate formula**, не полный CRUD в UI/SQLite.

---

### E. Terrain Engine — **PARTIAL**

**Файлы:** `src-tauri/src/terrain/mod.rs`, `src/services/terrain/terrainEngine.ts`, `TerrainPanel.tsx`

#### Таблица форматов (факт кода)

| Формат / алгоритм | Поддержка | Тест |
|-------------------|-----------|------|
| TIFF header II/MM magic 42 | Да | unit rejects_non_tiff, parses_minimal |
| ImageWidth/Length | Да | unit |
| ModelPixelScale (33550) | Да | unit DEM |
| ModelTiepoint (33922) | Да | unit DEM |
| Float32 sample format 3 | Да | unit DEM |
| Int16 / UInt16 / Int32 | Да (decode) | нет dedicated unit |
| Uncompressed strips (1) | Да | unit |
| Deflate 8 / 32946 (zlib then raw) | Да (код) | **нет** unit |
| Tiled (322–325) | Да (код) | **нет** unit |
| LZW / JPEG / PackBits | Нет → N/A message | — |
| BigTIFF | Нет | — |
| Geographic CRS only assumption (lon/lat) | Да, упрощение | нет projected CRS |
| Nodata heuristics | Да (range / MIN) | частично unit |

**Политика высот:** missing → `elevation_m: null`, `missing: true` — **не изобретает** значения. Подтверждено unit + e2e scenario B (логика N/A).

---

### F. Telemetry — **PARTIAL**

**Файлы:** `src/services/telemetry/normalize.ts` (+test), `TelemetryPanel.tsx`, `telemetry_append`

**Подтверждено:**
- Адаптеры esp32-json, generic-json, px4-json, ardupilot-json.
- null + warnings для missing voltage/temp.
- Vitest 3 cases.
- Append в SQLite при serial-data event (Tauri listen).

**Не подтверждено:**
- Реальный PX4/ArduPilot JSON bridge на проводе.
- История после restart UI (DB write есть; UI history — session memory).
- Malformed flood / backpressure.

**Ограничение соблюдено:** uplink pilot commands не добавлены.

---

### G. Gateway / Remote — **PARTIAL** (scaffold leaning)

**Файлы:**  
`src-tauri/src/gateway/mod.rs`, `src/services/gateway/index.ts`, `src/modules/remote/index.tsx`, `services/gateway-server/*`, `src/services/remote/*`

| Компонент | Статус |
|-----------|--------|
| Desktop config/status/enqueue/try_sync | PARTIAL — код есть |
| sync_outbox schema v3 | READY (schema) |
| HTTP POST sync (plaintext TCP HTTP/1.1) | PARTIAL — нет TLS client, нет auth headers, нет retry/backoff, нет idempotent server dedupe beyond PK |
| PostgreSQL DSN | PARTIAL — **TCP probe only** на desktop; real SQL на server при DATABASE_URL |
| Gateway server JSONL | PARTIAL stub |
| Gateway server TLS | PARTIAL — Node https + local certs |
| Gateway server PG ingest | PARTIAL — optional `pg` |
| Sandbox remote API | READY as sandbox (empty, synthetic flag) |
| Production sessions/MFA/WSS registry | MISSING |

**Не production-ready** как Central Infrastructure. Отчёт 0.9.0 это в целом признаёт.

---

### H. Security / Users / Plugins — **PARTIAL** / **NEEDS_REFACTOR** (session trust)

**Файлы:**  
`auth_session.rs`, `permissions.rs`, `authStore.ts`, Settings users UI, `pluginManager.ts`

**Подтверждено:**
- Roles Administrator / Operator / Observer.
- UI `can(...)` + NavRail locks.
- `require_role_write` блокирует Observer на write commands.
- `permissions::require` на station/inventory/user upsert.
- Plugin deny `*` и `system.exec`.
- Audit insert на user upsert (best-effort).

**Критические проблемы:**
1. **`auth_bind_session` принимает username/role с клиента без криптографической привязки к `db_verify_user_password` на backend.** Компрометация renderer → подмена роли.
2. Не все commands проходят `Permission::` granular checks (многие только Observer ban).
3. Plugin Manager — registry only, нет sandbox исполнения плагинов.
4. Нет тестов ACL на Rust command level (кроме косвенных).

---

### I. Workspace / Modules — **PARTIAL**

**Подтверждено:**
- Zustand workspace + SQLite sync.
- Lazy `WorkArea` imports + Suspense.
- `ModuleErrorBoundary` на module и panel.
- Robotics/Aerial/HID shells существуют.

**Gaps:**
- DnD/resize — код есть; e2e UI persistence **не** покрыт.
- Ошибка одного модуля: boundary есть; нет chaos-теста.
- Archive persist localStorage — inconsistency.

---

### J. Build / Release — **PARTIAL**

| Артефакт | Статус |
|----------|--------|
| typecheck/build/vitest/critical/cargo/e2e browser | READY (прогнано) |
| e2e Tauri WebView2 | NOT_VERIFIED (skipped) |
| tauri build / NSIS | NOT_VERIFIED (не запускался в аудите) |
| FFmpeg resources conf | READY config; embed **NOT_VERIFIED** |
| Updater runtime | MISSING plugin |
| Signing | Docs only |
| WebView2 on target PCs | NOT_VERIFIED |

---

## 5. Сводная таблица статусов модулей

| Модуль | Статус |
|--------|--------|
| SQLite migrations / open | PARTIAL |
| SSOT workspace/profiles | PARTIAL |
| DB backup | PARTIAL (no restore) |
| Device Manager | PARTIAL |
| Serial COM | PARTIAL / NOT_VERIFIED HW |
| USB enum | PARTIAL / NOT_VERIFIED HW |
| UVC MediaDevices | PARTIAL / NOT_VERIFIED HW |
| FFmpeg bundled+PATH | PARTIAL |
| RTSP probe/bridge | PARTIAL / NOT_VERIFIED live |
| Video recording (UVC) | PARTIAL |
| WebRTC video | PARTIAL (signaling) — **not READY** |
| MapLibre / tiles | PARTIAL / NOT_VERIFIED ops |
| Station Planner + AMSL | PARTIAL (math READY) |
| Terrain GeoTIFF | PARTIAL |
| Telemetry adapters | PARTIAL (unit READY) |
| Gateway client/server | PARTIAL scaffold |
| Auth/ACL | NEEDS_REFACTOR |
| Plugins | PARTIAL |
| Workspace UI | PARTIAL |
| Pan-Tilt (sim/monitor) | PARTIAL (policy OK) |
| Inventory/Reports/PDF | PARTIAL |
| Robotics/Aerial/HID | PARTIAL scaffold |
| NSIS / Updater / Signing | PARTIAL / MISSING |
| Playwright browser e2e | PARTIAL (shallow) |
| Playwright Tauri | NOT_VERIFIED |

---

## 6. Риски для 1.0.0

1. **Trust boundary auth_bind_session** — privilege escalation из UI.  
2. **Нет restore БД** — операционный риск потери данных.  
3. **RTSP bridge process hygiene** — stderr pipe / orphan ffmpeg.  
4. **Заявление WebRTC как video** в маркетинге/релизах без media — риск ложной готовности.  
5. **Gateway plaintext HTTP** + отсутствие auth на `/api/v1/sync`.  
6. **Archive localStorage** vs SSOT story.  
7. **Release без подписи / updater** — enterprise blockers.  
8. **Тесты structural/e2e shallow** — ложное чувство покрытия.  
9. **DEM tiled/deflate без тестов** — регресс незаметен.  
10. **FFmpeg не в git** — CI/release без `ffmpeg:fetch` → broken RTSP.

---

## 7. Оборудование и внешняя инфраструктура

**Нужно оборудование:** COM-устройство, USB gadget, UVC/HDMI capture, RTSP camera/encoder, HID gamepad, (опц.) реальный DEM GeoTIFF оператора.  

**Нужна инфраструктура:** PostgreSQL, TLS CA или доверенные certs, CDN updater, Authenticode cert, STUN/TURN + SFU для WebRTC media, WebView2 runtime на целевых ПК.

---

## 8. Честность отчёта 0.9.0

Отчёт о релизе в целом **не завышает** WebRTC/Gateway как полный production, если читать Progress/V21 docs. Риск — **смешение** «реализовано в коде» и «подтверждено в поле» в коммуникациях. Данный verification-отчёт разделяет эти уровни явно.

---

*Конец verification report 0.9.0. Следующие артефакты: `AETHER_V10_STABILIZATION_ROADMAP.md`, `AETHER_V10_TEST_MATRIX.md`, `AETHER_V10_RELEASE_CHECKLIST.md`.*
