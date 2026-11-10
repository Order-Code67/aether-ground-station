# Aether Ground Station — Test Matrix (towards 1.0.0)

**Аудит commit:** `0dda7b4`  
**Дата:** 2026-11-11  
**Легенда результата:** PASS / FAIL / SKIP / NOT_RUN / N/A  

| ID | Модуль | Сценарий | Ожидание | Факт (аудит S1) | Статус | Нужно оборудование / infra |
|----|--------|----------|----------|-----------------|--------|----------------------------|
| T01 | Build | `npm run typecheck` | без ошибок | PASS | PASS | нет |
| T02 | Build | `npm run build` | dist собран | PASS | PASS | нет |
| T03 | Build | `cargo test` | unit OK | PASS 6 (AMSL, TIFF×2, DEM float, PDF, auth bind msg) | PASS | нет |
| T04 | Build | Vitest | все green | PASS 13 (incl. auth/restore/syncSecret) | PASS | нет |
| T05 | Build | `test:critical` | 5 ok | PASS (structural) | PASS | нет |
| T06 | E2E | Playwright A AMSL | login shell + formula | PASS (evaluate, не full CRUD) | PASS | нет |
| T07 | E2E | Playwright B terrain N/A | missing→N/A | PASS (логика в page) | PASS | нет |
| T08 | E2E | Playwright C pan-tilt | monitoring null | PASS | PASS | нет |
| T09 | E2E | Playwright D reports | shape | PASS | PASS | нет |
| T10 | E2E | Playwright E remote sandbox | empty synthetic | PASS | PASS | нет |
| T11 | E2E | Tauri WebView2 smoke | shell loads | SKIP no `AGS_TAURI_URL` | SKIP | Tauri dev/app |
| T12 | Core | Migrations cold start | schema v3 | NOT_RUN automated; code path exists | NOT_RUN | temp profile dir |
| T13 | Core | Migrations re-run | no error | NOT_RUN | NOT_RUN | temp DB |
| T14 | Core | Corrupt DB | recoverable error | NOT_RUN | NOT_RUN | fixture |
| T15 | Core | Backup | `.bak` created | NOT_RUN (command exists) | NOT_RUN | Tauri |
| T16 | Core | Restore | data restored | `db_restore` + Settings UI + contract test | PASS (contract) | Tauri for full UI |
| T17 | SSOT | workspace↔SQLite | hydrate+mirror | code+critical structural | PARTIAL | Tauri for full |
| T18 | SSOT | archive localStorage | SQLite SSOT | persist removed; archive_state sync | PASS (contract) | — |
| T19 | Auth | login password verify | hash check | code path | NOT_RUN e2e | Tauri |
| T20 | Auth | Observer write blocked | Err Observer | code `require_role_write` | NOT_RUN | Tauri |
| T21 | Auth | bind session spoof role | must fail after P0-1 | bind disabled; auth_login only | PASS (contract+cargo) | — |
| T22 | Devices | COM list | ports listed | code | NOT_RUN | COM device |
| T23 | Devices | COM open/TX/close | works | code | NOT_RUN | COM |
| T24 | Devices | Reconnect after unplug | Reconnecting→Lost/Online | code | NOT_RUN | COM |
| T25 | Devices | USB enum | list | code | NOT_RUN | USB |
| T26 | Devices | UI no hang on lost | responsive | NOT_RUN | NOT_RUN | COM/UVC |
| T27 | Video | FFmpeg bundled resolve | available=true | bins present locally; runtime NOT_RUN in app | PARTIAL | Tauri |
| T28 | Video | FFmpeg PATH fallback | works without bundle | code | NOT_RUN | PATH ffmpeg |
| T29 | Video | UVC open | MediaStream | code | NOT_RUN | UVC |
| T30 | Video | RTSP probe OK/fail | ok/error | code | NOT_RUN | RTSP URL |
| T31 | Video | Bridge start/stop/restart | frames / cleanup | code | NOT_RUN | RTSP+FFmpeg |
| T32 | Video | No signal | error state | code paths | NOT_RUN | bad URL |
| T33 | Video | No device | no-device | code | NOT_RUN | no cam |
| T34 | Video | Record UVC to disk | file+DB meta | code | NOT_RUN | UVC |
| T35 | Video | WebRTC signaling connect | WS joined | relay code | NOT_RUN | `webrtc:relay` |
| T36 | Video | WebRTC SDP/ICE/media | MediaStream in UI | **not implemented** | FAIL/N/A | SFU/TURN |
| T37 | Map | Init MapLibre | map shown | code | NOT_RUN UI | Tauri/browser |
| T38 | Map | Offline mode | no network crash | code | NOT_RUN | — |
| T39 | Map | OSM tiles | load | code | NOT_RUN | network |
| T40 | Map | Station markers+azimuth | from SSOT | code | NOT_RUN | Tauri+stations |
| T41 | Station | CRUD persist restart | coords remain | code | NOT_RUN | Tauri |
| T42 | Station | AMSL math | 180+10+2=192; null→null | PASS vitest+cargo | PASS | нет |
| T43 | Terrain | Inspect GeoTIFF | meta | code+unit | PASS unit | synthetic |
| T44 | Terrain | Sample Float32 strip | elev | PASS cargo | PASS | synthetic |
| T45 | Terrain | Sample Deflate | elev or N/A | PASS cargo deflate float | PASS | fixture |
| T46 | Terrain | Sample tiled | elev | PASS cargo tiled float | PASS | fixture |
| T47 | Terrain | Unsupported compression | N/A message | PASS cargo LZW→missing | PASS | fixture |
| T48 | Terrain | No geotags | N/A | code | NOT_RUN | fixture |
| T49 | Telemetry | PX4 null fields | warnings | PASS vitest | PASS | нет |
| T50 | Telemetry | ArduPilot degE7 | lat/lon/alt/V | PASS vitest | PASS | нет |
| T51 | Telemetry | SQLite append | row written | code | NOT_RUN | Tauri+serial |
| T52 | Telemetry | History after restart | reload | telemetry_list hydrate on mount | PASS (code) | Tauri |
| T53 | Gateway | enqueue outbox | row pending | code | NOT_RUN | Tauri |
| T54 | Gateway | try_sync HTTP | sent / failed+retry | failed status + retry_failed | PASS (contract) | stub server |
| T55 | Gateway | TLS server | https health | server supports | NOT_RUN | certs |
| T56 | Gateway | PG ingest | rows in sync_events | server optional | NOT_RUN | PostgreSQL |
| T57 | Gateway | Desktop PG | SQL queries | **TCP probe only** | N/A | — |
| T58 | Gateway | Sync without auth | should 401 after P0-4 | stub 401; desktop requires syncSecret | PASS (contract) | stub |
| T59 | Plugins | deny `*` / system.exec | throw | code | NOT_RUN unit | — |
| T60 | Plugins | isolation crash | shell lives | boundary exists | NOT_RUN | — |
| T61 | Pan-Tilt | simulation local only | no hardware write | code UI | PARTIAL | — |
| T62 | Pan-Tilt | no remote actuator API | absent | confirmed grep policy | PASS | нет |
| T63 | Release | `tauri build` NSIS | installer | NOT_RUN | NOT_RUN | Windows SDK |
| T64 | Release | smoke:install | app starts | NOT_RUN | NOT_RUN | installer |
| T65 | Release | updater plugin | checks update | **not wired** | N/A | CDN+keys |
| T66 | Release | Authenticode | signed | docs only | N/A | cert |

---

## Сводка покрытия

| Категория | PASS | PARTIAL/code-only | SKIP/NOT_RUN | FAIL / missing |
|-----------|------|-------------------|--------------|----------------|
| Автоматы S1+S2 | T01–T10, T16/T21/T58 (contract), T42–T44, T49–T50, T62 | — | T11 | — |
| Требуют Tauri/HW/Infra | — | многие | большинство T12+ | T36 (media), T52 (history) |

**Вывод:** S2 закрыл P0 (auth_login, restore, ffmpeg gate, sync secret) с contract/cargo/vitest. **Не подтверждает** железо, RTSP lab, production Gateway, WebRTC media, NSIS.
