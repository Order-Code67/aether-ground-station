# Aether Ground Station — UX Architecture (GS-0 + GS-1 chrome)

**Документ:** `AETHER_UX_ARCHITECTURE.md`  
**Язык UI:** русский  
**Принцип:** одно ядро — единый интерфейс — независимые модули — единый SSOT.  
**Не цель:** десятки равнозначных пунктов меню.  
**Обновление GS-1:** TopBar = комплекс + площадка из `stationPlannerStore`; StatusBar = устройства/видео/телеметрия/предупреждения/**время обновления**; Dashboard = сводка активного комплекса (не profile-only).  
**Честно:** единый 4-pane Station Planner и GS-PT 3D — ещё не UX-ready (см. `AETHER_PRODUCT_ARCHITECTURE.md`).

---

## 1. Как сейчас vs как предлагается

### Сейчас (1.0.0)

```
[Logo]
 Рабочее пространство
 Карта
 Станции
 Рельеф
 Видео
 Walksnail
 Pan-Tilt
 Устройства
 Сеть
 USB
 COM
 Телеметрия
 Архив
 Инвентарь
 Отчёты
 Плагины
 Профили
 Удалённо
 Robotics
 Aerial
 HID
 Настройки
```

~22 пункта верхнего уровня; нет Dashboard; инженерные и операторские сценарии смешаны.

### Предлагается (целевой IA)

```
1. Главная          → Dashboard
2. Комплексы        → Organization / Complex / Site / Station
3. Карта и планирование → Map + Station Planner + Terrain + (Pan-Tilt geometry)
4. Видео            → Video Center (+ Walksnail + Archive clips)
5. Телеметрия       → Telemetry Center (+ Aerial observer data)
6. Оборудование     → Device Manager hub (+ USB/COM/Network/HID tabs)
7. События          → Event Center (+ Reports entry)
8. Настройки        → Basic | Advanced (Gateway, Plugins, JSON, Outbox)
```

Инженерные инструменты — **внутри** разделов (вкладки / «Расширенные»), не отдельные иконки NavRail.

---

## 2. Главная навигация (детализация)

| # | Раздел | Внутри (вкладки / панели) | Роли |
|---|--------|---------------------------|------|
| 1 | **Главная** | Сводка, виджеты, быстрые действия | Все |
| 2 | **Комплексы** | Дерево орг→комплекс→площадка→станция; Inventory привязки; события объекта | Admin/Op edit; Obs view |
| 3 | **Карта и планирование** | Карта · Карточка станции · Рельеф · Сравнение · Pan-Tilt geometry | Admin/Op; Obs view |
| 4 | **Видео** | Источники · Раскладки · Запись · Архив · Walksnail adapter | По правам video |
| 5 | **Телеметрия** | Источник · Параметры · Графики · История · Экспорт | Все (write Op+) |
| 6 | **Оборудование** | Все устройства · USB · COM · Сеть · HID · Inventory shortcut | Op+ manage |
| 7 | **События** | Журнал · Фильтры · Экспорт · Диагностика/Отчёты | Все |
| 8 | **Настройки** | Пользователи · Workspace · Бэкап · **Advanced** (Gateway, Plugins, raw JSON) | Admin; Op limited |

**Pan-Tilt Monitor** — вкладка в «Карта и планирование» и/или виджет на Dashboard; не отдельный top-level пункт.  
**Robotics / Aerial screens** — скрыты; данные aerial → Телеметрия.

---

## 3. Dashboard (Главная)

### 3.1 Виджеты (обязательный минимум)

| Виджет | Источник данных |
|--------|-----------------|
| Активный комплекс | `complexes` + UI selection (store) |
| Подключённые устройства | `DeviceManager` count by status |
| Статус станций | `stations` + equipment_status |
| Видеосистемы | Video adapters / signal state |
| Телеметрия | last `telemetry_records` / link state |
| Критические события | `event_log` severity error/warning |
| Локальная БД | path + schema version + last backup hint |
| Диск | новый lightweight cmd / OS query (ADD) |
| Интернет | existing network monitor / probe |

### 3.2 Раскладки Dashboard

Сохранять в `workspace_layouts` (или settings_kv) с шаблонами:

- **Оператор** — видео + статусы + события  
- **Инженер** — устройства + телеметрия + карта  
- **Администратор** — БД + пользователи + gateway health  
- **Пользовательская** — свободная компоновка виджетов  

Переиспользовать механизм Workspace Designer; не плодить второй layout engine.

---

## 4. Единая система статусов

Целевой словарь (отображение на русском + стабильный enum id):

| ID | UI (RU) | Применение |
|----|---------|------------|
| `online` | Online / На связи | Устройство, телеметрия |
| `offline` | Offline / Отключено | Устройство |
| `lost` | Lost / Потеряно | После обрыва |
| `connecting` | Connecting / Подключение | Устройство, видео |
| `reconnecting` | Reconnecting / Переподключение | DeviceManager |
| `error` | Error / Ошибка | Любой модуль |
| `no_device` | No Device / Нет устройства | Видео, COM |
| `no_signal` | No Signal / Нет сигнала | Видео |
| `not_configured` | Not Configured / Не настроено | Gateway, Walksnail mode |
| `not_available` | Not Available / N/A | Высоты, датчики, DEM |

**Маппинг legacy:**

- `DeviceStatus.Online` → `online`, … `Unknown` → `not_available` или `not_configured`
- `VideoSignalState.streaming|ok` → отдельный video substate `live` (допускается подмножество для видео: Live / Recording), но **корневые** No Device / No Signal / Error / Connecting совпадают
- Запрещены локальные «virt / ок / потеряна» без маппинга в словарь

Компонент: расширить `StatusBadge` → единый `EntityStatus`.

---

## 5. Рабочие пространства по ролям

| Роль | Default landing | Видимость Advanced |
|------|-----------------|--------------------|
| Observer | Главная (read-only) | Нет Gateway write / Plugins |
| Operator | Главная или Видео | Нет raw JSON / outbox |
| Administrator | Главная | Полный Advanced |
| Инженерский профиль layout | Оборудование + Телеметрия | Да (если Admin/доп. флаг) |

Workspace templates уже есть (`standard`, `video`, `map`, `engineering`, `custom`) — переименовать/расширить под роли, не заменить стек.

---

## 6. Ключевые экраны (wireframe-уровень)

### Комплексы
Левое дерево → справа карточка объекта (координаты, высоты N/A-safe, оборудование, события).

### Карта и планирование
Центр MapLibre; правая карточка станции; низ — Terrain Profile; оверлей азимута; offline tiles.

### Видео
Сетка источников; явные статусы; запись в выбранную папку; архив; Walksnail как тип источника.

### Оборудование
Одна таблица Device Manager; фильтр по типу подключения; детальная карточка; вкладки USB/COM как enum tools.

### События
Таблица + severity + category + search + export; retention уже частично (prune) — вынести в UI настроек хранения.

---

## 7. UX-правила данных

1. Нет устройства / сигнала → не показывать «живой» кадр.  
2. Нет DEM / высоты → **N/A**, не `0`.  
3. Неподтверждённый HW → бейдж «Не проверено в поле» только в Advanced/docs, не зелёный Online.  
4. Геометрический профиль ≠ прогноз радиоканала (disclaimer в UI Terrain).  
5. Pan-Tilt: Simulation / Monitoring / Local Status — без кнопок «повернуть удалённо».

---

## 8. Миграция навигации (без big-bang)

1. Ввести `NavSection` (8 пунктов) + `legacyModuleId` mapping.  
2. Старые `ModuleId` оставить как deep routes / panel kinds.  
3. Скрыть Robotics/Aerial/Remote из primary rail (feature flag / role).  
4. Dashboard ADD в GS-1 roadmap.

*Конец UX Architecture.*
