# Aether Ground Station — Field Test Report 1.0.0

**Дата:** 2026-11-11  
**Ветка документации/валидации:** `release/1.0.1-validation`  
**Release under test:** tag `v1.0.0` / commit `fa3e742`  
**Installed path:** `%LOCALAPPDATA%\Programs\Aether Ground Station`  
**Profile DB:** `%APPDATA%\aether\ground-station\data\ags.sqlite`

---

## 1. Результаты проверки установленного EXE

| Проверка | Статус | Факт |
|----------|--------|------|
| EXE launch | **PASS** | `aether-ground-station.exe` стартует |
| Launch via Desktop shortcut | **PASS** | Target = install EXE; relaunch OK |
| Start Menu shortcut | **PASS** | `...\Programs\Aether Ground Station\Aether Ground Station.lnk` |
| Launch with cwd=`System32` (no repo) | **PASS** | CommandLine = install path only |
| Repeated start / close / reopen | **PASS** | Stop-Process + shortcut relaunch |
| Bundled FFmpeg present | **PASS** | `resources/bin/ffmpeg.exe`, `ffprobe.exe`, codecs DLLs |
| FFmpeg runnable | **PASS** | `-version` OK |
| SQLite create/migrate | **PASS** | `ags.sqlite` ~299 KB; migrations 1–4 |
| Config / kv persist | **PASS** | `workspace_layouts` (2590 B), `devices_snapshot`, `auth_session` |
| Profiles key | **NOT_TESTED** | в kv не наблюдался `profiles` в этой сессии |
| Independent of source tree | **PASS** | no repo path in process CommandLine |
| Login UI | **PASS** | Event: `Вход: admin (Administrator)` |
| Dev-env bleed | **PASS** | ExecutablePath = Programs\... |

### Автоматика (репозиторий, не замена field)

| Suite | Статус |
|-------|--------|
| Vitest 23 | **AUTOMATED PASS** |
| Critical path | **AUTOMATED PASS** |
| Cargo unit | **FAIL** (1 flake: `unsupported_lzw_returns_missing` parallel race) — см. Failures |
| Playwright | **NOT_TESTED** в этой field-сессии |

---

## 2. Аппаратные испытания

См. детальную таблицу: `AETHER_101_HARDWARE_LAB_RESULTS.md`.

**Кратко:**
- COM / RTSP / HDMI / Walksnail / HID / flight telemetry wire → **BLOCKED** (нет устройств).
- UVC камера есть → in-app и FFmpeg grab → **FAIL** (permission / BindToObject).
- Map offline → **PASS** с soft **FAIL** (map worker warning).
- FFmpeg bundle → **PASS**.

---

## 3. Надёжность (поле)

| # | Сценарий | Статус | Комментарий |
|---|----------|--------|-------------|
| 1 | 30 мин soak | **NOT_TESTED** | не выдержан интервал в сессии |
| 2 | 2 ч soak | **NOT_TESTED** | — |
| 3 | USB unplug | **NOT_TESTED** | — |
| 4 | COM unplug | **BLOCKED** | нет COM |
| 5 | Video unplug | **NOT_TESTED** | capture уже FAIL |
| 6 | RTSP loss | **BLOCKED** | нет RTSP |
| 7 | FFmpeg crash mid-bridge | **NOT_TESTED** | bridge не стартовал |
| 8 | No internet | **NOT_TESTED** | offline map mode observed with network up |
| 9 | Gateway down | **NOT_TESTED** | contracts only |
| 10 | Gateway recover | **NOT_TESTED** | contracts only |
| 11 | App restart | **PASS** | relaunch + DB intact |
| 12 | SQLite backup restore UI | **NOT_TESTED** | command/contract AUTOMATED ранее |

**RAM spot:** процесс ~29 MB WorkingSet на момент замера (idle/login shell) — не soak.

**Orphan ffmpeg:** не обнаружены после stop.

---

## 4. Безопасность (поле + код)

| Проверка | Статус | Факт |
|----------|--------|------|
| Administrator login | **PASS** | admin session |
| Operator / Observer interactive | **NOT_TESTED** | роли не переключались в UI |
| Password verify | **AUTOMATED**/code | `auth_login` |
| Backend write guards | **AUTOMATED**/code | `require_role_write` |
| Gateway sync token | **AUTOMATED** | contracts; live NOT_TESTED |
| Plugin deny `*` / exec | **AUTOMATED**/code | manager; unit NOT_TESTED |
| Secrets in logs (spot) | **PASS** spot | event log без паролей в выборке |
| syncSecret at rest | **FAIL** (known) | plaintext в gateway_config JSON — см. Failures |
| Session TTL | **FAIL** (known) | нет idle timeout |
| Remote pilot / actuators | **PASS** policy | отсутствуют |
| Pan-Tilt modes | **NOT_TESTED** UI | code policy Simulation/Monitoring |

---

## 5. Terrain Engine

| Проверка | Статус |
|----------|--------|
| Float32 / Deflate / tiled unit | **AUTOMATED PASS** |
| LZW → N/A unit | **FAIL** test harness race (см. Failures); intended behavior CODE_OK |
| Int16 / nodata / no geotags / bad coords UI | **NOT_TESTED** |
| Unknown elevation = N/A | **AUTOMATED** AMSL/DEM contracts + policy |

---

## 6. Device Manager

| Проверка | Статус |
|----------|--------|
| Cards persist snapshot | **PASS** | kv `devices_snapshot` |
| Offline after restart semantics | **AUTOMATED**/code | hydrate Online→Offline |
| Live COM/UVC reconnect | **BLOCKED** / **FAIL** | нет COM; UVC permission |

---

## 7. Рекомендация (исполнительная)

См. `AETHER_101_FIX_ROADMAP.md` § Recommendation.

**Кратко:** **не выпускать 1.0.1 как “HW validated”** до устранения UVC permission FAIL и минимум одного успешного COM **или** RTSP lab.  
**Эксплуатация 1.0.0** как offline desktop MVP (SSOT/auth/map offline/FFmpeg bundle) — допустима с известными ограничениями.  
Приоритет патча 1.0.1: security (session TTL, syncSecret) + UVC WebView2 permission + test flake.

---

*Конец Field Test Report.*
