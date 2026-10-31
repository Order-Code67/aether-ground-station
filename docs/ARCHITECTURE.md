# Aether Ground Station — Архитектура (v0.4)

## Цель

Универсальная платформа Windows 11 для подключения и мониторинга наземных комплексов (Walksnail, IP/capture, ESP32, Arduino, сеть, карта). Новые устройства — через адаптеры, без переписывания ядра.

**Вне объёма:** боевое управление БПЛА, наведение, целеуказание, поражение, канал пилотирования через Remote.

## Стек

Tauri 2 · React 19 · TypeScript · Vite · Tailwind · Zustand · MapLibre · SQLite (`rusqlite`) · serialport · nusb · MediaDevices (WebView2)

## Слои

```
┌─────────────────────────────────────────────┐
│  UI modules (React) + ModuleErrorBoundary   │
├─────────────────────────────────────────────┤
│  Stores (Zustand) · auth · workspace · …    │
├─────────────────────────────────────────────┤
│  Services: DeviceManager · video adapters · │
│  telemetry normalize · network monitor ·    │
│  remote gateway stub · SQLite sync          │
├─────────────────────────────────────────────┤
│  Tauri commands (Rust): hardware · database │
└─────────────────────────────────────────────┘
```

## Модули UI

`workspace` · `video` · `walksnail` · `map` · `devices` · `network` · `usb` · `serial` · `telemetry` · `archive` · `profiles` · `remote` · `settings`

## Backend (`src-tauri`)

| Модуль | Назначение |
|--------|------------|
| `hardware/serial` | COM list/open/read/write + события `serial-data` |
| `hardware/usb` | Enumeration (`nusb`) |
| `hardware/ethernet` | Локальные IPv4 + TCP probe (без автоскана) |
| `database/sqlite` | Профили, layouts, events, devices snapshot, recordings, users, audit, kv_json |

## Device Manager

Единый реестр карточек. Статусы: `Online` · `Offline` · `Lost` · `Connecting` · `Warning` · `Error` · `Unknown`.  
Авто-reconnect через зарегистрированные handlers. UI не дублирует логику подключения.

## SQLite как источник правды

Фронтенд зеркалит workspace/profiles/devices в SQLite (`db_upsert_json` / hydrate).  
События и audit пишутся в отдельные таблицы. localStorage — только временный кэш UI, не SSOT.

## Auth / роли

Локальные пользователи: **Administrator** · **Operator** · **Observer**.  
Пароли — hash (sha2) в SQLite; сессия в kv.

## Видео

- Адаптер `mediadevices` — рабочий UVC/HDMI.
- `rtsp` / `webrtc` — отдельные адаптеры до нативного Video Capture Service.
- Запись: файл на диск + строка в `recordings`.

## Правила данных

- Нет фиктивных устройств и видеопотоков.
- `null` для отсутствующих датчиков.
- Сканирование COM/USB/сети только с разрешения.
- Секреты не в plaintext и не в логах / экспорте профилей.
