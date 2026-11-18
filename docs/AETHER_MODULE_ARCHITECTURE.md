# Aether Ground Station — Module Architecture (GS-0)

**Документ:** `AETHER_MODULE_ARCHITECTURE.md`  
**Стек (факт):** Tauri 2 · React · TypeScript · Rust · Zustand · SQLite · MapLibre · FFmpeg · Vitest · cargo test · Playwright.  
**Не вводить:** микросервисы, второй SSOT, параллельные Device Manager’ы.

---

## 1. Слои (сохранить)

```
┌──────────────────────────────────────────────────────┐
│  Shell: Auth · Nav (8 sections) · Dashboard · Toasts │
├──────────────────────────────────────────────────────┤
│  Feature modules (UI) — lazy, ModuleErrorBoundary    │
├──────────────────────────────────────────────────────┤
│  Zustand: session, nav, workspace, planner, devices  │
├──────────────────────────────────────────────────────┤
│  Services: DeviceManager, video, terrain, stations,  │
│            inventory, gateway, events, database      │
├──────────────────────────────────────────────────────┤
│  Tauri commands (Rust) — auth, hw, db, video, terrain│
├──────────────────────────────────────────────────────┤
│  SQLite SSOT (migrations v1…n)                       │
└──────────────────────────────────────────────────────┘
```

Правила:

1. Запись доменных данных — только через backend (+ role check).  
2. UI не выдумывает устройства и видеопотоки.  
3. Ошибка модуля не роняет shell (`ModuleErrorBoundary`).  
4. Долгие операции (FFmpeg, DEM, sync) — async, без блокировки UI.  
5. Секреты — не plaintext в export; gateway secret sealed (1.0.1).

---

## 2. Границы модулей (целевые)

| Модуль продукта | Владеет | Читает | Не делает |
|-----------------|---------|--------|-----------|
| **Dashboard** | Виджет layout prefs | Aggregates from services | Своя БД |
| **Complex Manager** | complexes, sites, station links | inventory, events | Видеозахват |
| **Station Planner** | station geo/AMSL UI, map selection | terrain samples, azimuth | RF prediction |
| **Mast/Antenna** | profiles + mounts | stations | Fake gain/beamwidth |
| **Terrain** | DEM sources, profiles | geotiff cmds | Подмена высот нулями |
| **Device Manager** | runtime device cards, reconnect | serial/usb/net adapters | Второй inventory |
| **Video Center** | sources, layouts, record, archive | FFmpeg, MediaDevices | Fake Live |
| **Telemetry Center** | normalize, history, charts | serial/JSON adapters | Pilot uplink |
| **Pan-Tilt Monitor** | sim/monitor display | telemetry/local adapter | Remote servo cmds |
| **Event Center** | filter/export UI | event_log, audit | Dual event store |
| **Inventory** | assets, maintenance | station/complex FKs | Дубль devices table |
| **Settings** | users, backup, advanced | gateway, plugins | Bypass auth |

---

## 3. Иерархия домена

```
Organization (optional, soft / payload until needed)
  └── Complex (complexes)
        └── Site (station_sites + complex_id)
              └── Station (stations)
                    ├── MastProfile ref (optional)
                    ├── AntennaMount* → AntennaProfile
                    ├── EquipmentAssignment* → equipment_inventory
                    └── Device links (runtime ids in payload / junction)
```

AMSL: `antenna_center = terrain + mast + offset`; missing terrain → NULL; unknown mast → NULL (не 0).

DEM entities (раздельно):

1. **Raw DEM source** (`terrain_sources`)  
2. **Processed DEM** (future / payload flag)  
3. **Map tiles** (XYZ/offline style — не высота)  
4. **Sampled values** (runtime / profile points)

---

## 4. Переиспользуемые backend commands

См. полный список в `AETHER_PRODUCT_AUDIT.md` §4.  
Новые (план, не в GS-0 коде): `complex_*`, `site_*`, `mast_profile_*`, `antenna_profile_*`, `station_mount_*`, `placement_scenario_*`, `disk_usage` (optional).

---

## 5. Stores (целевые)

| Store | Назначение |
|-------|------------|
| `authStore` | KEEP |
| `navigationStore` | Расширить sections |
| `workspaceStore` | KEEP + role templates |
| `deviceStore` / DeviceManager | KEEP single registry |
| `eventLogStore` | KEEP + Event Center filters |
| `stationPlannerStore` | **ADD** — active complex/site/station, map selection |
| `videoLayoutStore` | **ADD** or extend workspace | 
| `profileStore` | MERGE смысл в complexes |

Не плодить store на каждый USB/Serial экран.

---

## 6. Адаптеры

Сохранить adapter pattern:

- Video: mediadevices, rtsp(+ffmpeg), (webrtc later)  
- Telemetry: JSON normalize; ESP32/PX4/ArduPilot as parsers — monitor only  
- Walksnail: capture mode → Video Center  
- Pan-Tilt: local adapter only when present  

Manufacturer-agnostic: карточка устройства несёт manufacturer/model; ядро не хардкодит одного вендора.

---

## 7. Связь с документом 1.2

`AETHER_GROUND_STATION_12_ARCHITECTURE.md` детализирует Station/Terrain/Mast schema.  
Настоящий документ задаёт **продуктовые границы модулей и UX-контейнеры**. При конфликте нумерации этапов: **ориентир roadmap продукта** = `AETHER_GROUND_STATION_ROADMAP.md` (GS-0…GS-10).

---

## 8. Анти-паттерны (запрет)

- Новый SQLite файл «для комплексов»  
- Отдельное Electron/Web app для Planner  
- Remote pilot / actuator API  
- Показ WebRTC как Live без media PASS  
- Автоподстановка 0 в высоты  
- Микросервис Gateway внутри desktop без нужды  

*Конец Module Architecture.*
