# Aether Ground Station — Post-Release Audit 1.0.0 → план 1.0.1

**Дата аудита:** 2026-11-11  
**Исходная версия:** 1.0.0  
**Release tag:** `v1.0.0` → commit `fa3e742`  
**Documentation tip на main:** `b48b081` (после тега; только checklist docs)  
**Режим:** audit + documentation only (без push / без публикации / без смены schema)  
**Установленный экземпляр:** `%LOCALAPPDATA%\Programs\Aether Ground Station`

---

## 1. Проверка опубликованного релиза

| Проверка | Метод | Результат | Класс |
|----------|-------|-----------|-------|
| `package.json` = 1.0.0 | file read | PASS | AUTOMATED |
| `src-tauri/Cargo.toml` = 1.0.0 | file read | PASS | AUTOMATED |
| `tauri.conf.json` = 1.0.0 | file read | PASS | AUTOMATED |
| Release Notes | `docs/RELEASE_NOTES_1.0.0.md` | PASS | AUTOMATED |
| GitHub Release + NSIS | `gh release view v1.0.0` | PASS (~57 MiB asset) | AUTOMATED |
| Tag указывает на release commit | `git rev-list -n 1 v1.0.0` = `fa3e742` | PASS | AUTOMATED |
| FFmpeg в установленном пакете | install tree `resources/bin/` | PASS (`ffmpeg.exe`, `ffprobe.exe`, DLL) | MANUAL (файловая) |
| Запуск из install dir (не `tauri:dev`) | Start-Process exe | PASS (процесс жил ≥6 s) | MANUAL |
| SQLite создана вне каталога проекта | `%APPDATA%\aether\ground-station\data\ags.sqlite` (~299 KB) | PASS | MANUAL |
| Migrations v1–4 применены | sqlite query `schema_migrations` | PASS | MANUAL |
| Default user | `admin` / Administrator | PASS (seed) | MANUAL |
| Независимость от source tree | app data + resources под Local/Roaming Programs | PASS | MANUAL |
| Сохранение SSOT после запуска | `kv_json`: `workspace_layouts`, `devices_snapshot`, `auth_session` | PASS (ключи есть) | MANUAL |
| Полный UI login→CRUD→restart cycle | не прогонялся оператором в этой сессии аудита | **NOT_RUN** | MANUAL |
| Длительный soak installed build | не выполнялся | **NOT_RUN** | MANUAL |

### Замечания по релизу

1. **Tag vs HEAD:** тег `v1.0.0` = `fa3e742`; `main` tip = `b48b081` (docs-only). Код релиза согласован; документация tip чуть впереди тега.
2. **Сессия не переживает рестарт:** `auth_clear_session` + wipe `auth_session` на bootstrap — ожидаемо после P0; повторный login обязателен.
3. **Smoke install ранее:** `scripts/smoke-post-install.ps1` PASS (exe + shortcut + process) — зафиксировано в checklist; повторён короткий launch в аудите.

---

## 2. Подтверждённые функции 1.0.0 (evidence)

### AUTOMATED (тесты / артефакты)

- Typecheck / Vite build / Vitest / cargo unit / critical / Playwright A–F
- Auth: `auth_login` + disabled `auth_bind_session` (contract + cargo)
- Restore command + contract; FFmpeg prebuild gate; Gateway sync token contract
- DEM Float32 strip / Deflate / tiled; LZW → N/A
- AMSL formula; telemetry normalize PX4/ArduPilot
- Archive SSOT (no localStorage persist); outbox failed/retry contracts
- Permission matrix doc + structural ACL wiring
- NSIS build artifact published

### MANUAL (установленный desktop, без железа)

- Installer installs under Programs; FFmpeg bundled resources present
- App launches from installed path
- SQLite opens/migrates under Roaming profile
- No dependency on repo checkout for runtime binaries/DB

### HARDWARE_REQUIRED / NOT_AVAILABLE

- COM / UVC / HDMI capture / RTSP camera / Walksnail / HID sticks — **не проверялись физически** в этом аудите → не PASS  
- См. `AETHER_101_HARDWARE_TEST_RESULTS.md`

---

## 3. Проблемы (сводка)

| ID | Severity | Область | Описание |
|----|----------|---------|----------|
| PR-01 | Medium | Security | Нет TTL / idle timeout сессии (живёт до logout/exit) |
| PR-02 | Medium | Security | `gateway_config.syncSecret` пишется в `settings_kv` JSON plaintext (обходит фильтр `db_upsert_setting` на secret) |
| PR-03 | Low | Security | Password hashing = salted SHA-256 (не Argon2/bcrypt) |
| PR-04 | Low | Security | Default `admin`/`admin` seed; смена пароля — операционная дисциплина |
| PR-05 | Medium | Reliability | USB/COM/RTSP/UVC reconnect — только code-path; lab PASS отсутствует |
| PR-06 | Medium | Reliability | Long-run soak / memory / log growth — NOT_RUN |
| PR-07 | Low | Ops | HW checklist неполный (нет явных HID / Walksnail / HDMI / telemetry rows) |
| PR-08 | Low | Docs | Test Matrix T64 всё ещё мог числиться NOT_RUN в старой таблице — факт smoke PASS нужно синхронизировать в 1.0.1 docs |
| PR-09 | Low | Product | WebRTC media / Authenticode / updater — вне 1.0.0 (известные Preview/N/A) |
| PR-10 | Info | Release | Tag `fa3e742` ≠ tip `b48b081` (docs-only drift) |

---

## 4. Безопасность (кратко)

См. также секции в Reliability / Fix Roadmap.

| Тема | Ожидание | Факт (код / install) | Статус |
|------|----------|----------------------|--------|
| Login | password verify → role from DB | `auth_login` + `verify_credentials` | CODE_OK |
| Spoof bind | запрещён | `auth_bind_session` always Err | CODE_OK + tests |
| Session lifetime | политика TTL | только memory; clear on bootstrap; **нет TTL** | GAP → 1.0.1 |
| Roles | Observer read-only | `require_role_write` + permissions matrix | CODE_OK (e2e Observer NOT_RUN) |
| Gateway token | required | header + stub 401 + empty secret reject | CODE_OK + contract |
| Plugins | deny `*` / `system.exec` | `pluginManager.register` throws | CODE_OK (unit NOT_RUN) |
| Secrets in settings | no plaintext | `db_upsert_setting` blocks; **gateway JSON bypass** | GAP → 1.0.1 |
| Logs | no passwords | audit stores event names; eventBus messages без пароля в observed paths | CODE_OK (spot) |
| Remote pilot | absent | grep confirm | PASS |

---

## 5. Ресурсы (кратко)

| Ресурс | Ожидание | Факт | Статус |
|--------|----------|------|--------|
| FFmpeg bridge | kill on stop/exit; stderr drain | ExitRequested `force_stop`; stderr thread | CODE_OK; HW crash NOT_RUN |
| `live.jpg` | remove on stop | `remove_file` in stop | CODE_OK; field NOT_RUN |
| Serial handles | close on serial_close | command exists | CODE_OK; abrupt exit NOT_RUN |
| SQLite | single conn Mutex; path under Roaming | confirmed file + migrations | PASS (install) |
| RAM / logs | bounded | event_log уже 167 после коротких запусков | WATCH → 1.0.1 |
| Orphan ffmpeg after audit kill | none observed | Get-Process clean | PASS (spot) |

---

## 6. Итог аудита

**1.0.0 как offline desktop MVP подтверждён** на уровне: версии, GitHub Release, NSIS, bundled FFmpeg, install launch, SQLite profile, автотесты и P0/P1 hardening.

**Не подтверждены полевые аппаратные и длительные reliability сценарии** — они не могут считаться PASS без железа / soak.

**1.0.1** должен закрыть security/reliability gaps из Fix Roadmap без смены архитектуры.

---

## Связанные документы

- `AETHER_101_HARDWARE_TEST_RESULTS.md`
- `AETHER_101_RELIABILITY_MATRIX.md`
- `AETHER_101_FIX_ROADMAP.md`
- `RELEASE_NOTES_1.0.0.md`
- `AETHER_HW_LAB_CHECKLIST.md`
