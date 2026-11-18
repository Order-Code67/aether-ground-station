# Aether Ground Station — Reliability Matrix (post 1.0.0)

**Дата:** 2026-11-11  
**Сборка:** installed 1.0.0 (`fa3e742` / NSIS)  
**Легенда факта:**  
- **CODE_OK** — поведение реализовано в коде / покрыто автотестом  
- **INSTALL_OK** — подтверждено на установленном приложении  
- **NOT_RUN** — сценарий не исполнялся в поле  
- **GAP** — пробел / риск для 1.0.1

Автоматические доказательства и ручные испытания разделены явно.

---

## Сценарии

### R1. Длительная работа приложения

| | |
|--|--|
| **Ожидание** | UI отвечает; нет роста RAM без bound; логи/архив не раздуваются бесконтрольно |
| **Факт** | **NOT_RUN** (soak). Код: event_log append без ротации; archive_state JSON растёт с клипами |
| **Evidence** | sqlite `event_log` count=167 после коротких запусков |
| **Класс** | MANUAL soak required |
| **Вердикт** | GAP watch → 1.0.1 (log retention policy) |

### R2. Отключение USB-устройства

| | |
|--|--|
| **Ожидание** | Device card → Lost/Offline/Error; UI не зависает; serial reader останавливается |
| **Факт** | **CODE_OK** path (`setStatus` → scheduleReconnect). **NOT_RUN** физически |
| **Evidence** | `deviceManager.ts`, serial module |
| **Класс** | HARDWARE_REQUIRED |
| **Вердикт** | pending lab |

### R3. Повторное подключение устройства

| | |
|--|--|
| **Ожидание** | Reconnecting → Online если handler зарегистрирован; после restart — Offline до открытия панели |
| **Факт** | **CODE_OK** (3s retry; hydrate Online→Offline; intents persist). **NOT_RUN** HW |
| **Evidence** | `deviceManager.hydrate`, `device_intents` |
| **Класс** | HARDWARE_REQUIRED |
| **Вердикт** | pending lab; document operator step «откройте Serial/Video» |

### R4. RTSP источник перестаёт передавать видео

| | |
|--|--|
| **Ожидание** | phase `no-signal` / error overlay; без fake frames |
| **Факт** | **CODE_OK** (first-frame timeout 15s; poll status). **NOT_RUN** с камерой |
| **Evidence** | `video/mod.rs` phase, VideoPanel poll |
| **Класс** | HARDWARE_REQUIRED |
| **Вердикт** | pending lab |

### R5. FFmpeg завершается аварийно

| | |
|--|--|
| **Ожидание** | try_wait → stop bridge; message с code/stderr; UI no-signal/error |
| **Факт** | **CODE_OK**. **NOT_RUN** (forced kill ffmpeg mid-stream) |
| **Evidence** | `video_rtsp_bridge_status` / frame |
| **Класс** | MANUAL fault-injection |
| **Вердикт** | pending |

### R6. Закрытие приложения во время видеопотока

| | |
|--|--|
| **Ожидание** | FFmpeg child killed; `live.jpg` удалён; нет orphan процессов |
| **Факт** | **CODE_OK** (`RunEvent::Exit` → `force_stop`). Spot: после audit kill orphans не найдены. Full mid-stream close **NOT_RUN** |
| **Evidence** | `lib.rs` run callback; Get-Process clean after tests |
| **Класс** | MANUAL |
| **Вердикт** | likely OK; confirm in lab |

### R7. Перезапуск после аварийного завершения

| | |
|--|--|
| **Ожидание** | App стартует; SQLite открывается; login required; devices Offline; intents restored |
| **Факт** | **INSTALL_OK** cold start после Stop-Process: DB intact (migrations 1–4). Full crash dump scenario **NOT_RUN** |
| **Evidence** | `ags.sqlite` present; bootstrap clears session |
| **Класс** | MANUAL |
| **Вердикт** | PASS partial (forced stop, not OS crash) |

### R8. SQLite database недоступна

| | |
|--|--|
| **Ожидание** | Явная ошибка; нет silent invent данных |
| **Факт** | **CODE_OK** (`Connection::open` Err → String). Locked/corrupt file **NOT_RUN** |
| **Evidence** | `open_and_migrate` |
| **Класс** | MANUAL fault-injection |
| **Вердикт** | GAP test for 1.0.1 |

### R9. Восстановление резервной копии

| | |
|--|--|
| **Ожидание** | `db_backup` → mutate → `db_restore` возвращает данные |
| **Факт** | **CODE_OK** + contract test + Settings UI. Full UI on installed build **NOT_RUN** |
| **Evidence** | `db_restore`, `restore.contract.test.ts` |
| **Класс** | AUTOMATED contract + MANUAL UI |
| **Вердикт** | PASS contract; UI lab pending |

### R10. Отсутствует интернет

| | |
|--|--|
| **Ожидание** | Offline map mode работает; OSM fails gracefully; local SSOT жив; Gateway stale |
| **Факт** | **CODE_OK** offline style (vitest). Full airplane-mode installed UI **NOT_RUN** |
| **Evidence** | `offlineStyle()`, Remote stale indicator code |
| **Класс** | AUTOMATED style + MANUAL network |
| **Вердикт** | pending airplane-mode smoke |

### R11. Gateway недоступен

| | |
|--|--|
| **Ожидание** | outbox остаётся pending/failed; UI stale; нет false «sent» |
| **Факт** | **CODE_OK** (HTTP error → `failed` + attempts). Live stub down test **NOT_RUN** in this audit |
| **Evidence** | `mark_outbox_failed`, contracts |
| **Класс** | AUTOMATED contract + MANUAL |
| **Вердикт** | PASS contract |

### R12. Gateway снова доступен

| | |
|--|--|
| **Ожидание** | Retry failed → pending → sync sent |
| **Факт** | **CODE_OK** `gateway_retry_failed`. End-to-end stub **NOT_RUN** here |
| **Evidence** | gateway mod + Remote «Retry failed» |
| **Класс** | AUTOMATED contract + MANUAL |
| **Вердикт** | pending e2e stub |

---

## Сводка

| Вердикт | Сценарии |
|---------|----------|
| INSTALL/CODE partial PASS | R6 spot, R7 partial, R9 contract, R11–12 contract, R10 style |
| NOT_RUN / pending lab | R1–R5, R8 fault, R10 airplane, R6 full, R9 UI |
| 1.0.1 focus | R1 log retention, R8 corrupt DB UX, lab R2–R5 |

---

*Конец Reliability Matrix.*
