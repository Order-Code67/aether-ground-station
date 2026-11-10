# Aether Ground Station — Stabilization Roadmap → 1.0.0

**Связанный аудит:** [`AETHER_V09_VERIFICATION_REPORT.md`](./AETHER_V09_VERIFICATION_REPORT.md)  
**Базовый commit аудита:** `0dda7b4`  
**Цель:** стабильный desktop 1.0.0 без ложных заявлений о WebRTC media / production Gateway  
**Правила:** не пересоздавать проект; не remote pilot/actuators; Pan-Tilt = Simulation / Monitoring / Local Status only  

---

## 1. Принципы 1.0.0

1. **1.0.0 = подтверждённый offline desktop MVP**, а не полный §47 ТЗ.
2. Scaffold (WebRTC SFU, PG Central, updater CDN) либо доводится до критериев, либо явно помечается Preview в UI/docs.
3. Любой P0 закрывается тестом приёмки.
4. Изменения schema — только versioned migration v4+.
5. Push/release — только после явного согласования (не часть S1).

### Рекомендуемый scope 1.0.0

| Включено | Исключено из 1.0.0 (P3 / 1.1) |
|----------|------------------------------|
| SSOT + backup/restore | WebRTC MediaStream/SFU |
| ACL session hardening | Full PostgreSQL multi-tenant Central |
| Device Manager + Serial/USB/UVC verified paths | Authenticode mandatory (docs+optional) |
| RTSP bridge hygiene + FFmpeg embed CI | Aerial/Robotics deep integrations |
| DEM strip+tile+deflate tests | LZW/JPEG DEM |
| Telemetry history reload | MAVLink binary uplink |
| Gateway outbox reliability (HTTP+optional TLS) as **preview** | Production MFA/WSS mesh |
| NSIS unsigned OK + signing docs | Live updater CDN |

---

## 2. Приоритеты

### P0 — критично (безопасность / данные / запуск)

#### P0-1 Backend session binding — **DONE (S2)**
- **Проблема:** `auth_bind_session` принимает роль с frontend.  
- **Причина:** нет серверной привязки к успешной `db_verify_user_password`.  
- **Файлы:** `src-tauri/src/auth_session.rs`, `src/stores/authStore.ts`, `sqlite.rs`  
- **Исправление:** единый command `auth_login(username,password)` → выставляет session только после hash verify; убрать свободный bind role или ограничить debug.  
- **Риск:** средний (login UX).  
- **Зависимости:** нет.  
- **Приёмка:** Observer не может вызвать write даже при подмене invoke role без password; unit/integration Rust test.  
- **Тесты:** cargo test + vitest auth. ✅

#### P0-2 SQLite restore — **DONE (S2)**
- **Проблема:** есть `db_backup`, нет restore.  
- **Файлы:** `sqlite.rs`, Settings UI  
- **Исправление:** `db_restore(path)` с закрытием conn, копией, re-open migrate; UI кнопка.  
- **Риск:** средний (file replace).  
- **Приёмка:** backup→mutate→restore возвращает данные; тест на temp files. ✅

#### P0-3 Release FFmpeg gate — **DONE (S2)**
- **Проблема:** bins не в git; сборка без `ffmpeg:fetch` ломает RTSP.  
- **Файлы:** `scripts/fetch-ffmpeg.ps1`, CI/docs, optional prebuild check  
- **Исправление:** `tauri build` pre-step warn/fail если нет `resources/bin/ffmpeg.exe`.  
- **Приёмка:** documented CI; local script fails closed. ✅ `ffmpeg:check` / `pretauri:build`

#### P0-4 Gateway sync auth (если Gateway включён в 1.0 preview) — **DONE (S2)**
- **Проблема:** `/api/v1/sync` без токена.  
- **Исправление:** shared secret header + reject без него; desktop передаёт из config.  
- **Приёмка:** sync без secret → 401. ✅

---

### P1 — надёжность Core / Devices / Video / Gateway

#### P1-1 RTSP bridge process hygiene
- Читать/drain stderr; kill on app exit; timeout first-frame; clear status.  
- **Файлы:** `video/mod.rs`, VideoPanel  
- **Приёмка:** stop освобождает PID; повторный start OK; no-signal message.

#### P1-2 Device reconnect after app restart
- Persist last device intents or document re-register; no hung UI on lost COM.  
- **Файлы:** deviceManager, SerialPanel  

#### P1-3 Archive SSOT
- Перенести clips metadata в SQLite; убрать localStorage persist или сделать cache-only.  
- **Файлы:** `archiveStore.ts`  

#### P1-4 Outbox retry / failure states
- status `failed` + retry; не помечать sent при HTTP error; backoff.  
- **Файлы:** `gateway/mod.rs`, server  

#### P1-5 Permission matrix coverage
- Inventory всех write commands → `require` + table in docs.  
- **Тесты:** forbidden for Observer.

#### P1-6 Video signal state alignment
- Явные UI states Connecting/Streaming или документировать mapping на existing enum.

---

### P2 — совместимость Terrain / Telemetry / Map / HW

#### P2-1 DEM tests for Deflate + tiled fixtures  
#### P2-2 Telemetry history reload from SQLite on panel mount  
#### P2-3 Map offline pack documentation + smoke with local XYZ  
#### P2-4 Hardware lab checklist execution (COM/UVC/RTSP) — results into Test Matrix  
#### P2-5 Station CRUD Playwright (не только AMSL evaluate)  

---

### P3 — расширения (после 1.0.0)

- WebRTC SDP/ICE/MediaStream + SFU  
- Production PostgreSQL HA + WSS sessions  
- tauri-plugin-updater + CDN  
- Authenticode pipeline  
- LZW/JPEG/BigTIFF via GDAL sidecar  
- Robotics/Aerial deep adapters  
- Packaged WebView2 CDP e2e  

---

## 3. Рекомендуемые пакеты работ (после согласования)

| Пакет | Содержание | Выход |
|-------|------------|-------|
| **S2** | P0-1..P0-4 **закрыто** (auth_login, db_restore, ffmpeg gate, sync secret) | Security+data gates |
| **S3** | P1 Video/Device/Archive/Outbox | Reliability |
| **S4** | P2 tests + HW lab notes | Evidence pack |
| **S5** | NSIS build smoke + Release Checklist sign-off | 1.0.0 candidate |
| **S6+** | P3 optional | 1.1 |

---

## 4. Критерии готовности 1.0.0 (definition of done)

1. Все P0 закрыты и имеют автотесты.  
2. Verification table: нет BROKEN на Core/Auth/SSOT/Video UVC path.  
3. RTSP/WebRTC/Gateway в UI явно labeled (Preview) если не lab-verified.  
4. `typecheck`, vitest, critical, cargo test, e2e browser — green.  
5. Хотя бы один успешный `tauri build` NSIS на reference machine + smoke install.  
6. `AETHER_V10_TEST_MATRIX` обновлена фактическими результатами HW/infra где возможно.  
7. Нет remote pilot/actuator paths.  

---

## 5. Что не делать в стабилизации

- Массовый рефакторинг архитектуры  
- Замена MapLibre / Tauri / React  
- Добавление flight control  
- Удаление существующих тестов  
- Push в main без согласования  

---

*Конец roadmap 1.0.0.*
