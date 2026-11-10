# Aether Ground Station — Release Checklist 1.0.0

**Связь:** Verification Report 0.9.0 + Stabilization Roadmap  
**Правило:** не публиковать и не пушить без явного согласования.

---

## 0. Перед сборкой кандидата

- [x] Все **P0** из `AETHER_V10_STABILIZATION_ROADMAP.md` закрыты (S2)  
- [ ] Версия синхронизирована: `package.json` = `src-tauri/Cargo.toml` = `tauri.conf.json` = **1.0.0**  
- [ ] `CHANGELOG` / Progress обновлён честными формулировками (WebRTC = signaling unless media done)  
- [ ] Нет remote pilot / actuator command paths (grep review)  
- [ ] Pan-Tilt только Simulation / Monitoring / Local Device Status  

---

## 1. Ресурсы сборки

- [ ] `npm run ffmpeg:fetch` — `src-tauri/resources/bin/ffmpeg.exe` + `ffprobe.exe` (+ DLL)  
- [x] Prebuild gate: `ffmpeg:check` / `pretauri:build` fail closed без bins  
- [ ] `npm run services:install` (если в релиз входит gateway/webrtc stubs)  
- [ ] Icons/NSIS conf в `tauri.conf.json` проверены  
- [ ] `bundle.resources` включает `resources/bin/**/*`  

---

## 2. Автотесты (обязательно green)

```powershell
npm run typecheck
npm test
npm run test:critical
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:e2e
npm run build
```

- [ ] Все команды PASS  
- [x] Новые P0-тесты (auth login bind, restore, syncSecret) PASS  
- [ ] Matrix IDs T01–T10 обновлены  

---

## 3. Desktop / Tauri

- [ ] `npm run tauri:dev` — login, nav, module open без crash  
- [ ] `$env:AGS_TAURI_URL="http://127.0.0.1:1424"; npm run test:e2e:tauri` PASS  
- [ ] `npm run tauri:build` → NSIS artifact  
- [ ] `npm run smoke:install` (или ручная установка) — приложение стартует  

---

## 4. Функциональный smoke (reference machine)

### Core
- [ ] Чистый профиль: migrations apply  
- [ ] Backup создаётся  
- [x] Restore command + Settings UI (P0-2); full Tauri smoke still lab  

### Auth
- [ ] admin login  
- [ ] Observer не может write operations  
- [x] Нельзя повысить роль через сырой invoke (P0-1: bind disabled / auth_login)  

### Devices / Video (по наличию железа)
- [ ] COM list/open/close  
- [ ] UVC preview  
- [ ] RTSP probe + bridge start/stop (если камера)  
- [ ] Recording UVC → файл + metadata  
- [ ] UI не зависает при lost signal  

### Station / Terrain / Map
- [ ] CRUD станции → restart → данные на месте  
- [ ] AMSL N/A без elevation  
- [ ] GeoTIFF sample или явный N/A  
- [ ] Markers + azimuth visible  

### Telemetry
- [ ] JSON line → normalized UI  
- [ ] Missing fields → warnings / null  
- [ ] History survives restart (после P2)  

### Gateway (Preview)
- [ ] Labelled Preview в UI  
- [ ] Outbox enqueue + sync against local stub  
- [x] Auth secret required (P0-4: X-Ags-Sync-Token)  
- [ ] Stale indicator when offline  

### Explicit non-goals labels
- [ ] WebRTC UI: «signaling only» until media  
- [ ] Robotics/Aerial/HID: monitor-only  

---

## 5. Подпись и updater (опционально для 1.0.0)

- [ ] `docs/RELEASE_SIGNING.md` актуален  
- [ ] Если signing: signtool + timestamp  
- [ ] Если updater: pubkey в conf + CDN manifest + `tauri-plugin-updater` wired  
- [ ] Если **нет** signing/updater — зафиксировать в Release Notes как known limitation  

---

## 6. Документы релиза

- [ ] `AETHER_V09_VERIFICATION_REPORT.md` (или V10 verification delta)  
- [ ] `AETHER_V10_TEST_MATRIX.md` с заполненными HW результатами  
- [ ] `AETHER_V10_STABILIZATION_ROADMAP.md` — P0 отмечены done  
- [ ] Release Notes 1.0.0 (что READY / Preview / NOT included)  

---

## 7. Публикация (только после согласования)

- [ ] Tag `v1.0.0`  
- [ ] GitHub Release + NSIS artifact  
- [ ] Не force-push main  
- [ ] Не публиковать secrets (updater private key, certs)  

---

## 8. Откат

- [ ] Предыдущий installer сохранён  
- [ ] Backup SQLite оператора перед upgrade  
- [ ] Известная процедура restore  

---

*Чеклист не заменяет Test Matrix; оба артефакта используются вместе.*
