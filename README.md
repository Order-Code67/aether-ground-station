# Aether Ground Station

**Модульная настольная платформа (Windows 11)** для подключения и мониторинга наземных аппаратных комплексов: видеозахват, Walksnail VRX, COM/USB, сеть, карта, телеметрия, профили комплексов.

> Версия **0.6.0** (V2 Core+) · Tauri 2 · React 19 · TypeScript · SQLite

[Аудит V2](docs/AETHER_V2_IMPLEMENTATION_AUDIT.md) · [Roadmap](docs/AETHER_V2_IMPLEMENTATION_ROADMAP.md) · [Прогресс](docs/AETHER_V2_PROGRESS.md) · [Схема БД](docs/SCHEMA.md) · [Архитектура](docs/ARCHITECTURE.md)

---

## О проекте

Aether Ground Station (AGS) — локальная ground-station оболочка: устройства подключаются через **адаптеры**, состояние хранится в **SQLite**, интерфейс собирается как **конструктор workspace**.

### Вне объёма

Проект **не** включает:

- боевое управление БПЛА;
- наведение, целеуказание, поражение;
- канал пилотирования через Remote.

Remote Connectivity — только безопасный мониторинг и разрешённые админ-настройки (см. [docs/REMOTE_CONNECTIVITY.md](docs/REMOTE_CONNECTIVITY.md)).

---

## Возможности (v0.4)

| Область | Что есть |
|--------|----------|
| **Ядро** | Error boundaries по модулям; единый Device Manager (`Online` / `Offline` / `Lost` + auto-reconnect); SQLite как источник правды; локальный вход Administrator / Operator / Observer |
| **Видео** | UVC/HDMI через MediaDevices; адаптеры RTSP и WebRTC (заготовки до Video Capture Service); Walksnail с явным режимом вывода; запись на диск + метаданные в SQLite |
| **Workspace** | Drag-and-drop панелей, вкладки, pin/unpin, панель настроек виджета; пресеты Agriculture / Firefighting / Industrial / Ground Robotics / Monitoring / Custom |
| **Карта** | MapLibre: офлайн-база, локальные XYZ-тайлы, OSM по запросу; метки и измерение дистанций |
| **Телеметрия** | Нормализация через адаптеры (не протокол производителя в UI); история, предупреждения, экспорт CSV |
| **Сеть** | Локальные интерфейсы и Network Monitor (latency / loss / reconnect) **без** автоскана чужих сетей |
| **Remote** | Клиентские контракты API v0.3 + sandbox / gateway stub; audit |
| **Выпуск** | NSIS-установщик, smoke после установки, критичные автотесты |

### Принципы данных

- Нет фиктивных устройств и видеопотоков.
- Отсутствующие датчики остаются `null` / «нет данных».
- COM / USB / сеть — только после явного разрешения пользователя.
- Секреты не пишутся в plaintext и не попадают в экспорт профилей / логи.

---

## Стек

| Слой | Технологии |
|------|------------|
| Desktop shell | Tauri 2 (Rust) |
| UI | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand |
| Карта | MapLibre GL |
| Данные | SQLite (`rusqlite`) |
| Железо | `serialport`, `nusb`, локальные сетевые интерфейсы, MediaDevices (WebView2) |

---

## Требования

- Windows 11 (x64)
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable (для `tauri build` / `tauri dev`)
- WebView2 (обычно уже есть на Windows 11)

---

## Быстрый старт

```bash
git clone https://github.com/Order-Code67/aether-ground-station.git
cd aether-ground-station
npm install
npm run tauri:dev
```

Только фронтенд (preview без железа):

```bash
npm run dev
```

Локальный вход по умолчанию после первого запуска: **`admin` / `admin`** (смените пароль в проде).

---

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run tauri:dev` | Dev-режим с нативным backend |
| `npm run tauri:build` | Production-сборка + NSIS installer |
| `npm run typecheck` | TypeScript |
| `npm run build` | typecheck + Vite build |
| `npm run test:critical` | Критичные пути (COM list / workspace / profile import) |
| `npm run smoke:install` | Smoke после установки NSIS |

Установщик после `tauri:build`:

`src-tauri/target/release/bundle/nsis/Aether Ground Station_0.4.0_x64-setup.exe`

(путь к cargo-target может отличаться в CI / sandbox).

Установка: `%LOCALAPPDATA%\Programs\Aether Ground Station\`  
Исполняемый файл: `aether-ground-station.exe`  
Ярлык: «Aether Ground Station» на рабочем столе.

---

## Структура репозитория

```
aether-ground-station/
├── docs/                 # Архитектура, API адаптеров, remote, выпуск
├── scripts/              # critical-path tests, smoke post-install
├── src/                  # React UI, stores, services, modules
├── src-tauri/            # Rust: hardware, SQLite, Tauri commands
├── public/               # Статика, логотип
├── package.json
└── README.md
```

Ключевые модули UI: `workspace`, `video`, `walksnail`, `map`, `devices`, `network`, `usb`, `serial`, `telemetry`, `archive`, `profiles`, `remote`, `settings`.

---

## Документация

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архитектура ядра и модулей |
| [ADAPTERS_API.md](docs/ADAPTERS_API.md) | Контракты видео / телеметрии / Device Manager |
| [PLUGINS.md](docs/PLUGINS.md) | Точки расширения |
| [REMOTE_CONNECTIVITY.md](docs/REMOTE_CONNECTIVITY.md) | Remote Client / Gateway API v0.3 |
| [RELEASE.md](docs/RELEASE.md) | Сборка, подпись NSIS, smoke, автообновление |

---

## Roadmap (кратко)

1. Video Capture Service (Rust/FFmpeg) для RTSP/UVC вне WebView.
2. Выделенный Remote Gateway (TLS/VPN/сессии) как отдельный сервис.
3. Подписанный NSIS + `@tauri-apps/plugin-updater`.
4. Расширенные офлайн-карты (MBTiles).

---

## Связанные репозитории

Ранее разработка велась в монорепозитории [Order-Code67/aether](https://github.com/Order-Code67/aether)  
(ветка `cursor/windows-installer-ags-logo-626f`, коммит `3715c0f`).  
**Этот репозиторий** — канонический исходный код Aether Ground Station; код сверен с указанной веткой монорепо.

---

## Лицензия

Проприетарное ПО © Aether / Order-Code67. См. [LICENSE](LICENSE).  
Использование, копирование и распространение — только с разрешения правообладателя, если не оговорено иное.

---

## Контакты

Issues и обсуждения — во вкладке Issues этого репозитория.
