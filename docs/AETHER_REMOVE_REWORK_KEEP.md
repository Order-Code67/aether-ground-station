# Aether Ground Station — REMOVE / REWORK / KEEP (GS-0)

**Документ:** `AETHER_REMOVE_REWORK_KEEP.md`  
**Правило этапа:** ничего не удалять из кода до отдельного согласования и проверки зависимостей.  
**Этот файл — предложения для утверждения.**

---

## KEEP — сохранить (ядро)

| Элемент | Почему |
|---------|--------|
| Tauri 2 + React + TS + Zustand | Подтверждённый стек |
| SQLite SSOT + versioned migrations | Единый источник истины |
| Backup / Restore | Критично для поля |
| Auth + роли + Observer guard | Безопасность записи |
| Device Manager (сервис) | Единый реестр устройств |
| MapLibre + offline/XYZ | Карта |
| Station CRUD + AMSL formula | Station Planner база |
| Terrain GeoTIFF path + N/A policy | Высоты без выдумок |
| Video adapters + FFmpeg bridge | Видеоцентр |
| eventBus / event_log | События |
| Inventory + maintenance tables | Каталог оборудования |
| Workspace layouts | Раскладки |
| ModuleErrorBoundary | Изоляция сбоев |
| Automated tests (vitest/cargo/e2e critical) | Регрессии |
| Pan-Tilt safety boundary (no remote actuators) | Политика продукта |
| Gateway Preview код (backend) | Нужен инженерам — не операторам |

---

## HIDE — скрыть из основного UI (код оставить)

| Элемент | Куда | Условие показа |
|---------|------|----------------|
| Robotics view | Скрыт | Advanced / future flag |
| Aerial view | Скрыт | Данные через Телеметрию |
| Remote top-level | Advanced → Интеграции | Admin |
| Gateway Outbox / Sync Queue UI | Advanced → Gateway | Admin |
| Plugins manager | Advanced | Admin |
| Raw JSON / kv editors | Advanced → Отладка | Admin |
| HID top-level | Оборудование → вкладка HID | Engineer layout |
| WebRTC media entry | Скрыт | Пока нет реального media PASS |
| Demo/synthetic remote stations | Уже частично blocked | Test mode only |

---

## MOVE — перенести в другой раздел

| Сейчас | Куда |
|--------|------|
| Walksnail | Видео → источники / адаптеры |
| USB, Serial, Network | Оборудование → вкладки |
| Terrain | Карта и планирование → Рельеф |
| Stations | Карта и планирование **или** Комплексы (карточка) + карта |
| Pan-Tilt | Карта и планирование → Мониторинг ориентации |
| Archive clips | Видео → Архив |
| Events mini + Reports | События |
| Profiles (complex presets) | Комплексы |
| Gateway config | Настройки → Advanced |
| Network probe tools | Оборудование / Advanced диагностика |

---

## MERGE — объединить

| A | B | Результат |
|---|---|-----------|
| Devices UI | USB / Serial / Network / HID panels | **Оборудование** (один Device Manager UI) |
| Video | Walksnail | **Video Center** |
| Archive recordings | Video record path | Единый архив записей |
| Profiles «комплексы» | Таблица `complexes` | Один Complex Manager (без двух смыслов) |
| event_log UI + archive events | — | **Event Center** |
| StatusBadge + video labels + pan-tilt strings | — | Единый словарь статусов |

Не объединять физически таблицы `devices` и `equipment_inventory` без миграционного плана — это разные сущности (runtime connection vs asset catalog), связать через assignment.

---

## REWORK — переработать

| Элемент | Проблема | Направление |
|---------|----------|-------------|
| NavRail MODULES | 22 пункта | 8 разделов (§ UX) |
| StationsPanel | Нет complex/site; mast default 10/0 | N/A-safe + hierarchy |
| Map ↔ Stations ↔ Terrain | Разный state | `stationPlannerStore` |
| TelemetryPanel | Ограниченный UX | Telemetry Center (adapters, charts) |
| Inventory | Нет station/complex FK | Привязка к иерархии |
| Settings | Смесь user/advanced | Basic / Advanced tabs |
| SCHEMA.md | Drift v2 vs v4 | Синхронизация |
| DeviceStatus vs VideoSignalState | Разные слова | Unified mapping layer |
| Remote sandbox messaging | Риск путаницы с прод | Чёткий Preview badge |

---

## REMOVE — предложить удаление (только после dep-check)

| Кандидат | Риск | Решение сейчас |
|----------|------|----------------|
| Отдельные top-level route shells Robotics/Aerial **как продуктовые экраны** | Низкий (shell) | **HIDE** сначала; REMOVE UI entry позже |
| Дублирующие «демо» тексты/кнопки «Проверить политику» | Низкий | Убрать при HIDE |
| Неиспользуемые preset duplicates в profiles vs complexes | Средний | MERGE затем удалить мёртвый import path |
| Параллельный in-memory station map в browser vs SQLite | Нужен для e2e | Оставить preview path; не удалять |

**Запрещено REMOVE на этом этапе:** SQLite, FFmpeg, MapLibre, Auth, DeviceManager service, Backup, Telemetry backend, Event log.

---

## ADD — разработать (новое)

| Функция | Этап roadmap |
|---------|--------------|
| Dashboard / Главная | GS-1 |
| 8-пунктная навигация + role layouts | GS-1 |
| Complex & Site Manager UI + cmds | GS-2 |
| Station Planner unified workspace | GS-3 |
| Mast & Antenna Manager UI | GS-4 |
| Terrain Profile A–B + export + entity split DEM/tiles | GS-5 |
| Device hub UX consolidation | GS-6 |
| Video Center layouts / multi-source | GS-7 |
| Telemetry Center charts/history/export | GS-8 |
| Event Center filter/search/export UI | GS-9 |
| Workspace role packs + integration polish | GS-10 |
| Disk free space widget | GS-1 (лёгкий) |
| `station_antenna_mounts`, placement scenarios, site.complex_id | schema v5 (обоснованно) |
| Unified `EntityStatus` | GS-1 |

---

## Матрица решений (кратко)

| Решение | Count (ориентир) |
|---------|------------------|
| KEEP | Ядро платформы (~20 компонентов) |
| HIDE | 6–8 UI surfaces |
| MOVE | ~10 пунктов меню |
| MERGE | ~6 групп |
| REWORK | ~9 зон |
| REMOVE | 0 немедленных; 1–2 UI shells после HIDE |
| ADD | Dashboard + Complex/Site + catalogs + centers |

---

## Согласование обязательно для

1. Финальный список **HIDE** в 1.x vs ждать 1.2.  
2. Слияние Profiles → Complexes (breaking UX?).  
3. Schema v5 nullable mast / site.complex_id.  
4. Любой будущий REMOVE файлов.  
5. Переименование `ModuleId` (или только UI label mapping).

*Конец Remove/Rework/Keep.*
