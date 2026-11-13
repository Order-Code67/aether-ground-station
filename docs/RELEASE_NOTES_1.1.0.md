# Aether Ground Station v1.1.0 — release notes (draft)

**Дата:** 2026-11-13  
**Ветка:** `feature/gs-1-dashboard-navigation`  
**Publish:** только по явному OK оператора.

## Highlights

- **GS-6 Device hub:** карточка с last error, timeline событий, кнопка Reconnect.
- **GS-7 Video Center:** раскладки 1/2/4, Walksnail tab, статус **Live** только при кадрах, WebRTC скрыт, RTSP reconnect.
- **GS-8 Telemetry:** выбор адаптера, графики V/T°, GPS N/A, CSV с lat/lon/alt, monitor-only.
- **GS-10 Workspace:** role packs (Observer/Operator/Admin), sync complex/site/station.
- Ранее: aiming, COM pan-tilt read, пресеты, auto-login, slippy map.

## Smoke

- [ ] Вход без логина
- [ ] Карта + наведение + коридор DEM
- [ ] Оборудование: карточка / reconnect
- [ ] Видео: layout 2×, Live только со stream
- [ ] Телеметрия: адаптер + CSV
- [ ] Workspace: пакет роли + sync ids

## Known limits

- Local servo **write** не включён (нужен отдельный OK).
- WebRTC media не готов.
- Нет fake Live / fake RF.
