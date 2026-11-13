# Aether Ground Station — полный чек-лист выполненного (→ 1.0.0)

**Дата:** 2026-11-11  
**База аудита:** `0dda7b4` (0.9.0)  
**Релиз:** `v1.0.0` / `fa3e742` (+ docs `b48b081`)  
**GitHub Release:** https://github.com/Order-Code67/aether-ground-station/releases/tag/v1.0.0  
**Установщик:** https://github.com/Order-Code67/aether-ground-station/releases/download/v1.0.0/Aether-Ground-Station_1.0.0_x64-setup.exe  
**Локальная установка:** `%LOCALAPPDATA%\Programs\Aether Ground Station` (smoke OK)

---

## 0. Общий итог

- [x] Аудит 0.9.0 (S1) без переписывания проекта
- [x] Стабилизация P0 → P1 → P2 (S2–S4)
- [x] Кандидат 1.0.0 + NSIS + установка + публикация (S5)
- [x] Версии синхронизированы: `package.json` = `Cargo.toml` = `tauri.conf.json` = **1.0.0**
- [x] Нет remote pilot / actuator paths
- [x] Pan-Tilt = Simulation / Monitoring / Local Status only
- [x] WebRTC в UI: signaling only; Gateway: Preview

---

## 1. S1 — Аудит 0.9.0 (документы)

- [x] `docs/AETHER_V09_VERIFICATION_REPORT.md`
- [x] `docs/AETHER_V10_STABILIZATION_ROADMAP.md`
- [x] `docs/AETHER_V10_TEST_MATRIX.md`
- [x] `docs/AETHER_V10_RELEASE_CHECKLIST.md`
- [x] Оценка готовности / честность формулировок (WebRTC/Gateway)

---

## 2. S2 — P0 (безопасность / данные / сборка)

### P0-1 Auth session binding
- [x] Команда `auth_login(username, password)` → роль только после hash verify
- [x] `auth_bind_session` отключён (ошибка → использовать `auth_login`)
- [x] Frontend: `authStore` через `auth_login`
- [x] Contract / cargo тесты на bind-disabled

### P0-2 SQLite restore
- [x] `db_restore(path)` (закрытие conn → copy → reopen + migrate)
- [x] UI restore в Settings
- [x] Contract test restore

### P0-3 FFmpeg release gate
- [x] `scripts/check-ffmpeg-bundle.mjs`
- [x] `npm run ffmpeg:check`
- [x] `pretauri:build` fails closed без bins

### P0-4 Gateway sync secret
- [x] Header `X-Ags-Sync-Token`
- [x] Stub server → 401 без секрета
- [x] Desktop `syncSecret` в конфиге / Remote UI
- [x] Contract test syncSecret

### S2 verify
- [x] typecheck / build / vitest / cargo / critical / e2e
- [x] Commit `6ee62b4` → push main

---

## 3. S3 — P1 (надёжность)

### P1-1 RTSP bridge hygiene
- [x] Drain stderr FFmpeg
- [x] Kill bridge на Exit / ExitRequested
- [x] Timeout первого кадра → no-signal
- [x] Поле `phase`: connecting / streaming / no-signal / stopped / error

### P1-2 Device reconnect / intents
- [x] После restart: Online → Offline в hydrate
- [x] `device_intents` (Serial path/baud, RTSP URL)
- [x] Serial/Video панели восстанавливают intent

### P1-3 Archive SSOT
- [x] Убран zustand `persist` / localStorage
- [x] SQLite ключ `archive_state` через `useSqliteSync`

### P1-4 Outbox retry / failed
- [x] Migration **v4**: `attempts`, `last_error`
- [x] HTTP error → status `failed` (не `sent`)
- [x] `gateway_retry_failed` + кнопка Retry failed в Remote UI
- [x] `failedOutbox` в статусе

### P1-5 Permission matrix
- [x] `docs/AETHER_PERMISSION_MATRIX.md`
- [x] `require_role_write` на station / inventory / telemetry write + прочие write-команды
- [x] Contract test permission matrix

### P1-6 Video signal UI
- [x] Состояния `connecting` / `streaming`
- [x] `videoSignalLabel` → Connecting / Streaming

### S3 verify
- [x] Commit `b4053c1` → push main

---

## 4. S4 — P2 (доказательства / совместимость)

### P2-1 DEM fixtures
- [x] Cargo: uncompressed Float32
- [x] Cargo: Deflate Float32
- [x] Cargo: tiled Float32
- [x] Cargo: LZW → missing / N/A

### P2-2 Telemetry history reload
- [x] `telemetry_list`
- [x] TelemetryPanel hydrate из SQLite при mount

### P2-3 Map offline / XYZ
- [x] `docs/MAP_OFFLINE_XYZ.md`
- [x] Vitest offlineStyle / local XYZ / OSM

### P2-4 HW lab template
- [x] `docs/AETHER_HW_LAB_CHECKLIST.md` (заполнение на стенде — вручную)

### P2-5 Station e2e
- [x] Playwright F: `e2e/station-crud.spec.ts` (+ AMSL)

### S4 verify
- [x] Commit `b4b2fd5` → push main

---

## 5. S5 — Релиз 1.0.0

### Версия и документы
- [x] Bump **1.0.0** (package / Cargo / tauri.conf)
- [x] `docs/RELEASE_NOTES_1.0.0.md` (READY / Preview / NOT included)
- [x] Progress / Roadmap / Checklist обновлены
- [x] UI labels: Gateway Preview; WebRTC signaling only

### Сборка и установка
- [x] `npm run tauri:build` → NSIS `Aether Ground Station_1.0.0_x64-setup.exe` (~57 MiB)
- [x] Silent install `/S`
- [x] `scripts/smoke-post-install.ps1` — PASS (exe + shortcut + process)

### GitHub
- [x] Tag `v1.0.0` pushed
- [x] GitHub Release + asset NSIS
- [x] main: `fa3e742` Release 1.0.0; `b48b081` checklist install/release done

---

## 6. Автотесты (факт на релизе)

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm test` (vitest 23)
- [x] `cargo test` (10 unit)
- [x] `npm run test:critical`
- [x] `npm run test:e2e` (Playwright 6: A–F)
- [x] `npm run ffmpeg:check`
- [x] `npm run tauri:build` (NSIS)

---

## 7. Ключевые файлы (изменённые / добавленные)

### Auth / session
- [x] `src-tauri/src/auth_session.rs`
- [x] `src/stores/authStore.ts`
- [x] `src/services/auth/authLogin.contract.test.ts`

### Database / restore / migrations
- [x] `src-tauri/src/database/sqlite.rs` (`db_restore`)
- [x] `src-tauri/src/database/migrations.rs` (v4)
- [x] `src-tauri/src/database/stations.rs` / `inventory.rs` (ACL)
- [x] `src/services/database/restore.contract.test.ts`
- [x] `src/modules/settings/index.tsx` (restore UI)

### Video / RTSP
- [x] `src-tauri/src/video/mod.rs`
- [x] `src-tauri/src/lib.rs` (exit kill bridge)
- [x] `src/modules/video/VideoPanel.tsx`
- [x] `src/services/video/ffmpeg.ts`
- [x] `src/types/video.ts`

### Devices / archive
- [x] `src/services/devices/deviceManager.ts`
- [x] `src/modules/serial/SerialPanel.tsx`
- [x] `src/stores/archiveStore.ts`
- [x] `src/hooks/useSqliteSync.ts`

### Gateway
- [x] `src-tauri/src/gateway/mod.rs`
- [x] `services/gateway-server/server.mjs`
- [x] `src/services/gateway/index.ts`
- [x] `src/modules/remote/index.tsx`
- [x] `src/services/gateway/syncSecret.contract.test.ts`
- [x] `src/services/gateway/outboxRetry.contract.test.ts`

### Terrain / telemetry / map / e2e
- [x] `src-tauri/src/terrain/mod.rs` (DEM tests)
- [x] `src/modules/telemetry/TelemetryPanel.tsx`
- [x] `src/services/inventory/index.ts` (`listTelemetryRecords`)
- [x] `src/modules/map/mapStyles.ts` + `mapStyles.test.ts`
- [x] `e2e/station-crud.spec.ts`

### Build / permissions / config
- [x] `scripts/check-ffmpeg-bundle.mjs`
- [x] `src-tauri/permissions/database.toml`
- [x] `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`
- [x] `tsconfig.json` (exclude `*.test.ts` from app tsc)

### Документы
- [x] `docs/AETHER_V09_VERIFICATION_REPORT.md`
- [x] `docs/AETHER_V10_STABILIZATION_ROADMAP.md`
- [x] `docs/AETHER_V10_TEST_MATRIX.md`
- [x] `docs/AETHER_V10_RELEASE_CHECKLIST.md`
- [x] `docs/AETHER_V2_PROGRESS.md`
- [x] `docs/AETHER_PERMISSION_MATRIX.md`
- [x] `docs/MAP_OFFLINE_XYZ.md`
- [x] `docs/AETHER_HW_LAB_CHECKLIST.md`
- [x] `docs/RELEASE_NOTES_1.0.0.md`
- [x] `docs/CHECKLIST_DONE_1.0.0.md` (этот файл)

---

## 8. Commits (цепочка после 0.9.0)

| Commit | Содержание |
|--------|------------|
| `6ee62b4` | S2 P0: auth_login, db_restore, FFmpeg gate, sync secret |
| `b4053c1` | S3 P1: RTSP, devices, archive SSOT, outbox retry, ACL |
| `b4b2fd5` | S4 P2: DEM tests, telemetry reload, map docs, station e2e |
| `fa3e742` | Release 1.0.0 |
| `b48b081` | Docs: install smoke + GitHub release checklist |

---

## 9. Что осталось вне 1.0.0 (не сделано / опционально)

- [ ] Заполнить HW lab результаты в Test Matrix на железе
- [ ] Authenticode signing
- [ ] Live updater CDN + `tauri-plugin-updater`
- [ ] WebRTC MediaStream / SFU
- [ ] Production PostgreSQL HA / WSS mesh
- [ ] Tag GitHub Release notes polish / CI artifact pipeline (по желанию)
- [ ] P3 / 1.1 расширения (S6+)

---

## 10. Быстрые команды проверки

```powershell
npm run typecheck
npm test
npm run test:critical
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:e2e
npm run ffmpeg:check
npm run build
npm run smoke:install
```

---

*Конец чек-листа выполненного к 1.0.0.*
