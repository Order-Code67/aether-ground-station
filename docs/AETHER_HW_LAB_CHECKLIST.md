# Hardware Lab Checklist (P2-4)

Заполняйте на reference machine. Результаты переносите в `AETHER_V10_TEST_MATRIX.md`.

| ID | Сценарий | Оборудование | Результат | Дата | Примечание |
|----|----------|--------------|-----------|------|------------|
| T22 | COM list | USB-UART | | | |
| T23 | COM open/TX/close | USB-UART | | | |
| T24 | Reconnect unplug | USB-UART | | | |
| T25 | USB enum | USB hub | | | |
| T27 | FFmpeg bundled | — | | | `ffmpeg:check` |
| T29 | UVC open | webcam/HDMI capture | | | |
| T30 | RTSP probe | IP camera | | | |
| T31 | Bridge start/stop | IP camera + FFmpeg | | | |
| T34 | Record UVC | webcam | | | |
| T37 | MapLibre init | — | | | |
| T39 | OSM tiles | network | | | |
| T40 | Markers+azimuth | stations in DB | | | |
| T63 | tauri build NSIS | Windows SDK | | | |

**Правило:** нет remote pilot / actuator. Pan-Tilt = Simulation / Monitoring only.
