# Release: NSIS + code signing + updater

## NSIS

Сборка: `npm run tauri:build` → installer в `src-tauri/target/release/bundle/nsis/`.

Конфиг: `src-tauri/tauri.conf.json` → `bundle.targets: "nsis"`.

Smoke: `npm run smoke:install`.

## Code signing (Windows)

Подпись **не блокирует** функциональный V2, но нужна для SmartScreen / enterprise.

1. Получить Authenticode сертификат (EV или standard).
2. Перед сборкой задать:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "<path-or-key>"
# или через signtool после сборки:
signtool sign /fd SHA256 /a /tr http://timestamp.digicert.com /td SHA256 path\to\installer.exe
```

3. Хранить ключи вне репозитория.

## Updater (опционально)

Tauri 2 updater требует `tauri-plugin-updater` + публичный ключ и endpoint с манифестом.

Пока endpoint не развёрнут:

- desktop обновляется через NSIS reinstall;
- конфиг endpoints оставляем пустым / документируем здесь.

Когда появится CDN:

```json
"plugins": {
  "updater": {
    "pubkey": "<base64-pubkey>",
    "endpoints": ["https://releases.example/aether/{{target}}/{{current_version}}"]
  }
}
```

## PostgreSQL Central Server

Desktop: SQLite SSOT + `sync_outbox` + HTTP `/api/v1/sync`.

Сервер (отдельный деплой): принимает batch, пишет в PostgreSQL. DSN на клиенте используется для TCP health-probe (`gateway_status`), не для прямого пилотирования.
