# Aether Ground Station — Failures Register (field 1.0.0)

**Дата:** 2026-11-11  
**Ветка:** `release/1.0.1-validation`  
**Под тест:** installed 1.0.0 / `fa3e742`

Каждая запись: ID · Severity · Area · Status · Steps · Expected · Actual · Logs · Next.

---

## F-001 — UVC MediaDevices Permission denied (installed app)

| | |
|--|--|
| **Severity** | High (field video path) |
| **Area** | Video / WebView2 |
| **Status** | **FAIL** |
| **Steps** | 1) Install 1.0.0 2) Login admin 3) Open Video panel UVC/HDMI 4) Observe signal |
| **Expected** | Camera listed; Connecting→Streaming or clear permission prompt that can succeed |
| **Actual** | UI: permission denied by system / No device; Signal: No device |
| **Logs** | Event strip showed No device; auth login OK |
| **Env** | PnP camera **Chicony USB2.0 Camera** Status=OK |
| **Next** | 1.0.1: WebView2 camera permission / capability; document Windows Privacy → Camera; verify after granting |

---

## F-002 — FFmpeg dshow cannot BindToObject (same camera)

| | |
|--|--|
| **Severity** | High / related to F-001 |
| **Area** | FFmpeg / OS capture |
| **Status** | **FAIL** |
| **Steps** | Installed `ffmpeg.exe -f dshow -i "video=Chicony USB2.0 Camera" -frames:v 1 out.jpg` |
| **Expected** | JPEG frame written |
| **Actual** | `Unable to BindToObject for Chicony USB2.0 Camera` / I/O error; exit -5 |
| **Logs** | `%TEMP%\ags_ffmpeg_err.txt` |
| **Next** | Check exclusive lock (other apps), Windows camera privacy for desktop apps, retry after killing browsers; decide if GS should use ffmpeg dshow path as fallback when MediaDevices denied |

---

## F-003 — Map worker failed to load

| | |
|--|--|
| **Severity** | Low |
| **Area** | Map Engine |
| **Status** | **FAIL** (soft) |
| **Steps** | Launch installed app → Map panel offline |
| **Expected** | Offline map without errors |
| **Actual** | Offline base shown; Event log `WARNING map: Worker failed to load` |
| **Next** | Reproduce; check MapLibre worker bundling in production WebView2 |

---

## F-004 — Gateway syncSecret plaintext at rest

| | |
|--|--|
| **Severity** | Medium (security) |
| **Area** | Gateway / SQLite |
| **Status** | **FAIL** (code audit; confirmed design) |
| **Steps** | Code review `gateway_set_config` → `settings_kv` JSON |
| **Expected** | Secret not stored as open text (or OS-protected) |
| **Actual** | `syncSecret` inside `gateway_config` JSON bypasses `db_upsert_setting` secret filter |
| **Next** | 1.0.1 SEC: encrypt / DPAPI / `enc:` envelope |

---

## F-005 — No auth session TTL / idle lock

| | |
|--|--|
| **Severity** | Medium (security) |
| **Area** | Auth |
| **Status** | **FAIL** (gap) |
| **Steps** | Code review `AuthSessionState` |
| **Expected** | Idle timeout / re-auth policy |
| **Actual** | Session until logout/exit; cleared on cold start only |
| **Next** | 1.0.1 configurable idle timeout |

---

## F-006 — Cargo test flake: LZW fixture race

| | |
|--|--|
| **Severity** | Low (CI) |
| **Area** | Terrain unit tests |
| **Status** | **FAIL** intermittent |
| **Steps** | `cargo test` parallel |
| **Expected** | `unsupported_lzw_returns_missing` PASS |
| **Actual** | Panic `range start index 54 out of range for slice of length 0` (shared temp file `ags_dem_f32.tif`) |
| **Next** | Unique temp filenames per test; no shared path |

---

## Blocked (не FAIL продукта — нет оборудования)

| ID | Topic | Reason |
|----|-------|--------|
| B-COM | All COM/Serial field cases | No COMn |
| B-RTSP | RTSP probe/bridge | No camera URL |
| B-HDMI | HDMI capture | No device |
| B-WS | Walksnail | No device |
| B-HID | Controller HID | No gamepad |
| B-TEL | Live PX4/Ardu/ESP32 | No wire |

---

## NOT_TESTED (сессия)

- 30 min / 2 h soak  
- Airplane mode  
- Gateway live stub  
- Station CRUD + restart persistence UI  
- OSM / XYZ UI modes  
- Operator/Observer interactive matrix  
- Backup/restore UI on installed build  
- Video unplug after successful stream  

---

*Конец Failures Register.*
