# Aether Ground Station — Hardware Test Results (post 1.0.0)

**Дата:** 2026-11-11  
**Стенд:** reference machine (Windows) — installed 1.0.0  
**Правило:** аппаратный тест **не** отмечается PASS без физической проверки.  
**Классы:** AUTOMATED | MANUAL | HARDWARE_REQUIRED | NOT_AVAILABLE

---

## 1. Полнота матрицы vs `AETHER_HW_LAB_CHECKLIST.md`

Существующий checklist покрывает: COM, USB enum, UVC/HDMI (совмещённо), RTSP, FFmpeg, Map, NSIS.

**Пробелы checklist (добавить в 1.0.1 docs, не в код):**

| Пробел | Почему нужен |
|--------|----------------|
| HDMI capture отдельной строкой | сейчас слито с UVC |
| Walksnail-compatible capture | модуль есть; lab row отсутствует |
| Telemetry adapters (ESP32/PX4/ArduPilot wire) | только vitest normalize |
| Controller HID enumeration | модуль HID monitor-only |
| Serial TX/RX с реальным контроллером | только open/close intent |
| Gateway stub sync с железом offline | не HW, но lab ops |

---

## 2. Результаты (этот аудит)

| ID | Сценарий | Класс | Результат | Evidence | Примечание |
|----|----------|-------|-----------|----------|-----------|
| T22 | COM list | HARDWARE_REQUIRED | **NOT_RUN** | code `serial_list_ports` | нет USB-UART в аудите |
| T23 | COM open/TX/close | HARDWARE_REQUIRED | **NOT_RUN** | code path | — |
| T24 | Reconnect unplug | HARDWARE_REQUIRED | **NOT_RUN** | deviceManager scheduleReconnect | handlers session-only |
| T25 | USB enum | HARDWARE_REQUIRED | **NOT_RUN** | `list_usb_devices` | — |
| T26 | UI no hang on lost | HARDWARE_REQUIRED | **NOT_RUN** | — | — |
| T27 | FFmpeg bundled | MANUAL + AUTOMATED | **PASS (files)** / runtime NOT_RUN | install `resources/bin/ffmpeg.exe` + DLLs; `ffmpeg:check` | runtime probe в UI не гонялся |
| T28 | FFmpeg PATH fallback | MANUAL | **NOT_RUN** | code resolve PATH | — |
| T29 | UVC open | HARDWARE_REQUIRED | **NOT_RUN** / **NOT_AVAILABLE*** | MediaDevices adapter | *камера не подтверждена в аудите |
| T29b | HDMI capture | HARDWARE_REQUIRED | **NOT_AVAILABLE** | same UVC path | нет capture card |
| T30 | RTSP probe | HARDWARE_REQUIRED | **NOT_RUN** / **NOT_AVAILABLE** | `video_probe_rtsp` | нет IP cam URL |
| T31 | Bridge start/stop | HARDWARE_REQUIRED | **NOT_RUN** | bridge hygiene code | — |
| T32 | No signal / FFmpeg exit | HARDWARE_REQUIRED | **NOT_RUN** | phase `no-signal`/`error` | — |
| T34 | Record UVC | HARDWARE_REQUIRED | **NOT_RUN** | MediaRecorder path | — |
| T35 | WebRTC signaling | MANUAL | **NOT_RUN** | relay script | Preview |
| T36 | WebRTC media | N/A | **N/A** | not implemented | 1.1+ |
| WS-01 | Walksnail via capture | HARDWARE_REQUIRED | **NOT_AVAILABLE** | Walksnail panel | нет устройства |
| HID-01 | Controller HID enum | HARDWARE_REQUIRED | **NOT_AVAILABLE** | HID module monitor-only | нет геймпада в аудите |
| TEL-01 | Telemetry live serial JSON | HARDWARE_REQUIRED | **NOT_RUN** | adapters vitest PASS | wire NOT_RUN |
| TEL-02 | Telemetry history reload | AUTOMATED/code | **PASS (code)** | `telemetry_list` | full Tauri UI NOT_RUN |
| T37 | MapLibre init | MANUAL | **NOT_RUN** | installed UI | — |
| T38 | Map offline | AUTOMATED | **PASS (vitest style)** | `mapStyles.test.ts` | UI smoke NOT_RUN |
| T39 | OSM tiles | MANUAL | **NOT_RUN** | needs network | — |
| T40 | Markers+azimuth | MANUAL | **NOT_RUN** | needs stations | — |
| T63 | NSIS build | AUTOMATED | **PASS** | GitHub asset | — |
| T64 | smoke:install | MANUAL | **PASS** | smoke script + audit launch | — |

\* Если на машине есть webcam, строка T29 остаётся NOT_RUN до явного прогона UI.

---

## 3. Сводка по классам

| Класс | Count (approx) | Комментарий |
|-------|----------------|-------------|
| AUTOMATED PASS | FFmpeg gate, map styles, telemetry normalize, DEM, AMSL, NSIS | не заменяет HW |
| MANUAL PASS | install tree FFmpeg, smoke launch, SQLite profile | desktop install |
| HARDWARE_REQUIRED NOT_RUN | COM/USB/UVC/RTSP/record/reconnect | ждут lab |
| NOT_AVAILABLE | HDMI card, Walksnail, HID (в этой сессии) | нет устройства |
| N/A | WebRTC media | вне 1.0.0 |

---

## 4. Рекомендуемый порядок lab для 1.0.1

1. USB-UART: T22–T24  
2. Webcam UVC: T29, T34, T26  
3. RTSP camera + bundled FFmpeg: T30–T32  
4. Optional: HDMI capture, Walksnail, HID  
5. Перенести результаты в Test Matrix с датой/оператором — **без** ложного PASS

---

*Конец Hardware Test Results.*
