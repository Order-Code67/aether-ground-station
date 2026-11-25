# Плагины и расширение AGS

## Принципы

1. Плагин не обходит Device Manager и SQLite.
2. Плагин не подставляет фиктивную телеметрию/видео.
3. Remote-плагины не получают канал пилотирования.

## Adapter SDK

Файл `src/services/plugins/adapterSdk.ts`:

- `assertSafePermissions` — запрет `*`, `system.exec`, `shell.exec`.
- `registerPluginTelemetryAdapter(manifest, adapter)` — только при `telemetry.parse` и включённом плагине.
- Адаптер обязан возвращать `null` для неизвестных полей, не подставлять 0.

## Точки расширения

| Точка | Контракт |
|-------|----------|
| Video adapter | `VideoAdapter` (`listSources` / `open`) |
| Telemetry adapter | `TelemetryAdapter` (`parse` → `NormalizedTelemetry`) |
| Workspace panel | `PanelKind` + регистрация в `PanelHost` |
| Remote service | реализация `RemoteGateway` |
| Device source | upsert в `deviceManager` |

## Workspace constructor

Панели: HTML5 drag-and-drop между колонками, веса, pin/unpin, правая панель настроек выбранного виджета, вкладки layout.

## Профили комплексов

Agriculture / Firefighting / Industrial / Ground Robotics / Monitoring / Custom — через `COMPLEX_PRESETS`.

## Будущий Rust Video Capture Service

Отдельный процесс/crate: FFmpeg RTSP/UVC → кадры в WebView. Frontend остаётся на адаптерах.
