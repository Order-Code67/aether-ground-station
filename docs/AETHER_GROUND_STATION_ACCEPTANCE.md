# Aether Ground Station — Acceptance Criteria (Product Restructuring)

**Документ:** `AETHER_GROUND_STATION_ACCEPTANCE.md`  
**GS-0 exit:** документация + отчёт на согласование (ниже §0).  
**Код:** не менялся в GS-0.

---

## 0. Приёмка GS-0 (документация)

| # | Критерий | Статус |
|---|----------|--------|
| 1 | Репозиторий изучен | PASS (docs) |
| 2 | Функциональность инвентаризирована | PASS → `AETHER_PRODUCT_AUDIT.md` |
| 3 | Целевая структура UI описана | PASS → `AETHER_UX_ARCHITECTURE.md` |
| 4 | REMOVE/HIDE/MOVE/MERGE/REWORK/KEEP/ADD | PASS → `AETHER_REMOVE_REWORK_KEEP.md` |
| 5 | Архитектура модулей | PASS → `AETHER_MODULE_ARCHITECTURE.md` |
| 6 | Зависимости и риски | PASS → audit + roadmap |
| 7 | План разбит на этапы | PASS → `AETHER_GROUND_STATION_ROADMAP.md` |
| 8 | Рабочий код не изменён ради GS-0 | PASS |

---

## 1. Сквозные продуктовые критерии (после GS-10)

1. Не более **8** пунктов основной навигации.  
2. Есть **Главная** со сводкой комплекса / устройств / видео / телеметрии / событий / БД.  
3. Можно вести **несколько комплексов** и площадок без пересечения записи.  
4. Станции на карте MapLibre; координаты и AMSL с **N/A** без авто-нулей.  
5. Мачты и антенны каталогизируются; неизвестные RF-поля = N/A.  
6. Один **Device Manager** для USB/COM/UVC/HDMI/RTSP/Walksnail/HID/…  
7. Видео не показывает Live без реального потока; WebRTC не заявлен готовым без PASS.  
8. Телеметрия — monitor/adapters; нет pilot/actuator remote.  
9. Pan-Tilt — simulation/monitoring/local only.  
10. Event Center: filter/search/export + retention.  
11. Inventory связан с комплексом/площадкой/станцией.  
12. SQLite остаётся SSOT; backup/restore работает.  
13. Workspace layouts сохраняются; ошибки модуля не роняют shell.  
14. Роли Observer/Operator/Admin соблюдены на backend.  
15. Автотесты зелёные; HW PASS только после физического теста.  
16. Terrain disclaimer: геометрия ≠ качество радио/видео.  
17. Gateway/Outbox не в primary UI оператора.  
18. Нет push/tag/publish без согласования.

---

## 2. Приёмка по этапам (кратко)

### GS-1
- [ ] Nav = 8 разделов на русском  
- [ ] Dashboard виджеты минимального набора  
- [ ] Unified status mapping покрывает device+video  
- [ ] Robotics/Aerial/Remote скрыты из primary  
- [ ] typecheck/test/e2e smoke  

### GS-2
- [ ] CRUD complex/site  
- [ ] Станция привязана к площадке/комплексу  
- [ ] Изоляция записи «чужого» комплекса  
- [ ] Migration tests + backup  

### GS-3
- [ ] Карта + карточка в одном сценарии  
- [ ] Edit coords persist SQLite  
- [ ] Azimuth overlay  
- [ ] Mast unknown → N/A (не 0)  

### GS-4
- [ ] Mast types + antenna catalog  
- [ ] Multi-mount на станцию  
- [ ] Нет выдуманных gain/beamwidth  

### GS-5
- [ ] DEM source registered with meta  
- [ ] A–B profile + export  
- [ ] Missing = N/A; RF disclaimer visible  

### GS-6
- [ ] Один UI «Оборудование»  
- [ ] Карточка: status, last seen, errors  
- [ ] Reconnect where adapter exists  

### GS-7
- [ ] Multi-source + layouts  
- [ ] Record + archive  
- [ ] Statuses Connecting/Live/No Signal/No Device/Error  
- [ ] WebRTC hidden  

### GS-8
- [ ] Adapter sources; N/A fields  
- [ ] History + export  
- [ ] No uplink commands  

### GS-9
- [ ] Filter/search/export events  
- [ ] Retention configurable  
- [ ] Critical categories covered  

### GS-10
- [ ] Role workspaces  
- [ ] Cross-module selection sync  
- [ ] Full suite + install smoke  
- [ ] Release notes draft; **publish only on OK**

---

## 3. Аппаратная приёмка (отдельно)

Любой маркетинг/UI «поддерживается Walksnail/UVC/RTSP/COM» как **PASS** — только после записи в HW lab results.  
Иначе: Not Configured / Not Available / Not Verified.

---

## 4. Регрессионный минимум перед merge этапа

```
npm run typecheck && npm run build && npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:critical && npm run test:e2e
```

Роли · workspace save · backup restore · schema version · no dual-write SSOT.

*Конец Acceptance.*
