# Aether Ground Station — Hardware Lab Results (1.0.0 field)

**Дата:** 2026-11-11  
**Ветка:** `release/1.0.1-validation`  
**Сборка:** installed NSIS 1.0.0 (`fa3e742`)  
**Стенд:** Windows 11 · `%LOCALAPPDATA%\Programs\Aether Ground Station`  
**Правило:** без реального устройства / доступа к устройству → не PASS.

Статусы: **PASS** | **FAIL** | **BLOCKED** | **NOT_TESTED** | **AUTOMATED** | **HARDWARE_REQUIRED**

---

## 0. Инвентаризация стенда

| Ресурс | Факт |
|--------|------|
| COM / USB-UART | **Нет** видимых `COMn` (`SerialPort.GetPortNames` пуст) |
| USB | Есть (в т.ч. Chicony camera composite `VID_04F2&PID_B729`) |
| UVC | PnP: **Chicony USB2.0 Camera** Status=OK |
| HDMI capture | **Нет** |
| RTSP camera / URL | **Нет** |
| Walksnail | **Нет** |
| HID gamepad | **Нет** |
| ESP32 / PX4 / ArduPilot wire | **Нет** |
| Сеть | ICMP 8.8.8.8 = True |
| FFmpeg в install | `resources/bin/ffmpeg.exe` + DLLs, `-version` OK |

---

## 1. COM / Serial

| ID | Проверка | Статус | Evidence |
|----|----------|--------|----------|
| S-01 | Обнаружение COM | **BLOCKED** | нет портов |
| S-02 | Открытие порта | **BLOCKED** | нет портов |
| S-03 | Baud select | **BLOCKED** | — |
| S-04 | RX data | **BLOCKED** | — |
| S-05 | Close | **BLOCKED** | — |
| S-06 | Unplug mid-session | **BLOCKED** | — |
| S-07 | Replug | **BLOCKED** | — |
| S-08 | Restore after app restart | **BLOCKED** | intents code exists; HW отсутствует |
| S-09 | No hung COM handles | **NOT_TESTED** | нечем открывать |

**Класс:** HARDWARE_REQUIRED · устройство отсутствует → BLOCKED.

---

## 2. USB

| ID | Проверка | Статус | Evidence |
|----|----------|--------|----------|
| U-01 | Enum устройств (OS) | **PASS** | Get-PnpDevice USB OK (host + composites) |
| U-02 | Список в приложении (USB panel) | **NOT_TESTED** | UI panel не прогнан пошагово в этой сессии |
| U-03 | Unplug / replug | **NOT_TESTED** | не выполнялось |
| U-04 | Device Manager card state | **PASS** (частично) | UI: «Беспроводная сеть» Offline в Equipment; snapshot в SQLite |

---

## 3. Видео

| ID | Источник | Проверка | Статус | Evidence |
|----|----------|----------|--------|----------|
| V-01 | Bundled FFmpeg | version / presence | **PASS** | install tree + `-version` |
| V-02 | UVC OS visibility | PnP | **PASS** | Chicony OK |
| V-03 | UVC in app (MediaDevices) | connect / preview | **FAIL** | UI: «Permission denied by system» / Signal: No device |
| V-04 | UVC via installed FFmpeg dshow | 1-frame grab | **FAIL** | `Unable to BindToObject for Chicony USB2.0 Camera` |
| V-05 | HDMI capture | — | **BLOCKED** | нет устройства |
| V-06 | Walksnail via capture | — | **BLOCKED** | нет устройства |
| V-07 | RTSP probe/bridge | — | **BLOCKED** | нет URL/камеры |
| V-08 | No signal / reconnect / release | — | **BLOCKED** / **NOT_TESTED** | зависит от V-03–V-07 |
| V-09 | Signal states in UI | labels present | **PASS** (UI observed) | Connecting/Streaming/No device labels; MediaDevices → No device |

**Вывод видео:** камера на стенде есть, но **захват заблокирован** (WebView2 permission и/или эксклюзивная блокировка / privacy). Это **FAIL полевой**, не отсутствие железа.

---

## 4. Телеметрия

| ID | Проверка | Статус | Evidence |
|----|----------|--------|----------|
| T-A1 | Adapter unit tests PX4/ArduPilot/null | **AUTOMATED PASS** | vitest normalize 3 tests |
| T-A2 | Live ESP32/JSON serial | **BLOCKED** | нет COM + контроллера |
| T-A3 | Live PX4 / ArduPilot | **BLOCKED** | нет |
| T-A4 | SQLite append live | **NOT_TESTED** | `telemetry_records` count=0 |
| T-A5 | History reload code | **AUTOMATED** (code) | `telemetry_list`; UI live NOT_TESTED |

---

## 5. Controller HID

| ID | Проверка | Статус |
|----|----------|--------|
| H-01 | Enumeration | **BLOCKED** — нет gamepad/HID controller |
| H-02–H-05 | Axes/buttons/unplug | **BLOCKED** |

Pilot/actuator mapping: **не тестировалось и не допускается** (policy OK).

---

## 6. Map / Station Planner / Terrain / Gateway

| ID | Проверка | Статус | Evidence |
|----|----------|--------|----------|
| M-01 | Map start offline | **PASS** | UI «Офлайн (без тайлов)»; log offline base |
| M-02 | Map worker warning | **FAIL** (soft) | Event log: `WARNING map: Worker failed to load` |
| M-03 | OSM online | **NOT_TESTED** | сеть есть, режим OSM не переключали в UI |
| M-04 | Local XYZ | **AUTOMATED** style | vitest `mapStyles.test.ts`; UI NOT_TESTED |
| M-05 | Airplane mode | **NOT_TESTED** | — |
| ST-01 | Station CRUD + persist | **NOT_TESTED** | stations count=0; UI CRUD не прогнан |
| ST-02 | Azimuth lines | **NOT_TESTED** | — |
| TR-01 | DEM unit Float32/Deflate/tiled | **AUTOMATED PASS** | cargo (кроме LZW flake — см. Failures) |
| TR-02 | DEM Int16 / nodata / no geotags UI | **NOT_TESTED** / partial AUTOMATED | LZW missing intended |
| GW-01 | Gateway UI Preview | **NOT_TESTED** interactive | token/retry **AUTOMATED** contracts |
| GW-02 | Live stub sync | **NOT_TESTED** | — |

---

## 7. Непроверенные / отсутствующие устройства (сводка)

- USB-UART / любой COM  
- HDMI capture card  
- RTSP IP camera  
- Walksnail  
- HID controller  
- ESP32 / PX4 / ArduPilot physical links  

---

*Конец Hardware Lab Results.*
