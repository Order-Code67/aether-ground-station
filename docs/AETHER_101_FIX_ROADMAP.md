# Aether Ground Station — Fix Roadmap after Field Validation 1.0.0

**Дата:** 2026-11-11  
**Ветка:** `release/1.0.1-validation` (docs; код 1.0.0 не патчился в этом этапе)  
**Источники:**  
`AETHER_101_FIELD_TEST_REPORT.md` · `AETHER_101_HARDWARE_LAB_RESULTS.md` · `AETHER_101_FAILURES.md` · prior post-release audit

**Ограничения:** без новой архитектуры; без remote pilot/actuators; Pan-Tilt = Simulation/Monitoring/Local Status; не публиковать без OK; schema только с обоснованием.

---

## Recommendation (исполнительная)

### Выпускать 1.0.1 сейчас?

**Нет — не как “hardware-validated” release.**

| Вопрос | Ответ |
|--------|-------|
| Можно ли продолжать эксплуатацию **1.0.0**? | **Да**, как offline desktop MVP (SSOT, auth login, map offline, FFmpeg bundle, install independence), с известными ограничениями |
| Нужен ли патч **1.0.1**? | **Да**, но после fixes: UVC permission (F-001/F-002), security (F-004/F-005), test flake (F-006), map worker (F-003) |
| Можно ли заявлять HW PASS? | **Нет** — COM/RTSP/HDMI/Walksnail/HID BLOCKED; UVC FAIL |

**Не переходить к Station Planner next-gen**, пока не закрыты F-001 и security P0, и пока не получен хотя бы один живой lab PASS (COM **или** RTSP **или** UVC streaming).

---

## 1. Подтверждённые функции (field + automated)

- Install EXE / shortcuts / relaunch / no repo cwd dependency  
- Bundled FFmpeg present and runs `-version`  
- SQLite profile + migrations 1–4; workspace kv persist  
- Administrator login on installed build  
- Map offline mode displays  
- Vitest 23 + critical path PASS  
- DEM Float32/Deflate/tiled unit PASS  
- Telemetry adapter unit PASS  
- Policy: no remote pilot/actuators  

---

## 2. Список неисправностей

См. `AETHER_101_FAILURES.md`:

| ID | Sev | Кратко |
|----|-----|--------|
| F-001 | High | UVC MediaDevices permission denied in installed app |
| F-002 | High | FFmpeg dshow BindToObject fail on same camera |
| F-003 | Low | MapLibre worker failed to load (warning) |
| F-004 | Med | Gateway syncSecret plaintext at rest |
| F-005 | Med | No session idle TTL |
| F-006 | Low | Cargo LZW test shared-temp race |

---

## 3. Непроверенные / отсутствующие устройства

- COM / USB-UART  
- HDMI capture  
- RTSP source  
- Walksnail  
- HID controller  
- Live ESP32 / PX4 / ArduPilot  
- 30 min / 2 h soak, airplane mode, Gateway live, Station CRUD UI, Observer UI  

---

## 4. Проблемы безопасности

1. F-004 syncSecret plaintext  
2. F-005 no session TTL  
3. Default admin/admin (ops)  
4. SHA-256 password KDF (low, backlog)  
5. Observer interactive NOT_TESTED  

---

## 5. Проблемы производительности

1. Soak NOT_TESTED (30 min / 2 h)  
2. event_log growth (175+ rows after short use) — retention backlog  
3. JPEG bridge base64 poll cost — NOT_TESTED (bridge not started)  
4. Map worker failure may imply wasted retries  

---

## 6. Необходимые исправления (очереди задач)

### 1.0.1-A — Security (делать первыми, узкий diff)

| Task | Fix | Failure |
|------|-----|---------|
| SEC-1 | Idle session timeout + re-login | F-005 |
| SEC-2 | Protect `syncSecret` at rest | F-004 |

### 1.0.1-B — Field blockers

| Task | Fix | Failure |
|------|-----|---------|
| VID-1 | WebView2 / Windows camera permission path for MediaDevices | F-001 |
| VID-2 | Document + optional FFmpeg dshow fallback when MD denied; privacy checklist | F-002 |
| MAP-1 | Investigate MapLibre worker in packaged WebView2 | F-003 |
| TST-1 | Unique temp paths in DEM LZW unit test | F-006 |

### 1.0.1-C — Lab (не код)

| Task | Action |
|------|--------|
| LAB-COM | USB-UART: open/TX/unplug/replug |
| LAB-UVC | After VID-1: streaming + unplug |
| LAB-RTSP | Probe/bridge/no-signal with real URL |
| LAB-SOAK | 30 min + optional 2 h with RAM/process notes |

### Не делать в 1.0.1

- Next-gen Station Planner  
- WebRTC media / SFU  
- Authenticode / updater CDN  
- Remote pilot  
- Mass refactor / schema churn without need  

---

## 7. План выпуска 1.0.1 (после fixes)

1. Реализовать SEC-1/SEC-2 + VID-1 + TST-1 на ветке от `release/1.0.1-validation` или `fix/1.0.1-*`  
2. Повторить installed smoke + UVC PASS  
3. Хотя бы один LAB-* PASS задокументировать  
4. Bump 1.0.1 · NSIS · Release Notes  
5. Tag/publish **только после явного согласования**  

---

## 8. Backlog 1.1.0

- WebRTC media  
- Signing + updater  
- Production Gateway HA  
- Argon2 password migration  
- Formal soak harness  
- GDAL optional DEM  
- Expanded HW CI where possible  

---

## Definition of Done для «можно 1.0.1»

- [ ] F-001 или документированный workaround с PASS streaming  
- [ ] F-004, F-005 закрыты  
- [ ] F-006 зелёный в `cargo test`  
- [ ] Минимум 1 hardware path PASS (COM|UVC|RTSP)  
- [ ] Autotests green + installed smoke  
- [ ] Согласование publish  

---

*Конец Fix Roadmap (field-updated).*
