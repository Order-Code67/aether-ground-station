# Aether GS — процесс разработки

**Дата:** 2026-11-13  
**Ветка-база:** `feature/gs-1-dashboard-navigation`

## Правила ветки

1. Короткий `feature/…`: **одна фича → тесты → локальная установка → релиз только по явному OK**.
2. Не смешивать UX и HW/SEC в одном PR.
3. Перед merge в `main`: smoke — вход без логина, карта, наведение, профиль DEM.
4. Push / merge `main` / tag / publish — только после OK оператора.

## Smoke перед merge

- [ ] Приложение открывается без экрана логина (auto-enter).
- [ ] Карта: спутник + рельеф + подписи.
- [ ] Наведение: точка / направление / радиус / патчи / мачта / коридор на карте.
- [ ] Инженерия: профиль DEM по азимуту обновляется при смене мачты.
- [ ] COM pan-tilt (если порт есть): только чтение AZ/EL; запись на серво отсутствует.

## Порядок продукта (backlog)

1. Адаптер pan-tilt **read** (COM `serial-data`) — в работе / каркас есть  
2. Пресеты наведения (SQLite JSON) — каркас есть  
3. Device hub (GS-6)  
4. Video Center (GS-7)  
5. Telemetry (GS-8)  
6. Workspace polish (GS-10)  

**Локальный write серво** — отдельный этап, только после явного OK по безопасности.

## CI

На каждый PR: `npm run typecheck` + `npm test` (vitest).  
Полная NSIS-сборка — release smoke / workflow_dispatch (долго на runner).

## Команды

```
npm run typecheck
npm test
npm run test:e2e
npm run tauri build
```
