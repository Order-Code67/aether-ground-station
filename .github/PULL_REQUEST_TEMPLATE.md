## Summary
<!-- Что изменилось и зачем -->

## Test plan
- [ ] `npm run typecheck`
- [ ] `npm run test:critical`
- [ ] при нативных изменениях: `cargo check` в `src-tauri`
- [ ] при UI/железе: `npm run tauri:dev` — ручная проверка

## Checklist
- [ ] Нет mock-устройств / фиктивного видео / подставной телеметрии
- [ ] Новое железо через адаптер + Device Manager
- [ ] Секреты не в логах и не в коммите
- [ ] Docs обновлены при изменении публичных контрактов
