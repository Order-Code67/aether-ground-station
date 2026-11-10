# Playwright + Tauri WebView2

## Dev WebView (simplest)

1. `npm run tauri:dev`
2. Open DevTools remote debugging if enabled, **or** run against the Vite URL that Tauri loads:

```powershell
$env:AGS_TAURI_URL = "http://127.0.0.1:1424"
npm run test:e2e:tauri
```

In `tauri dev` the frontend is the same Vite origin — this covers UI flows inside the desktop shell process.

## Full WebView2 (packaged)

1. Build: `npm run ffmpeg:fetch` then `npm run tauri:build`
2. Launch installer / exe with remote debugging port (Windows):

```powershell
& ".\src-tauri\target\release\aether-ground-station.exe" -- --remote-debugging-port=9222
```

3. Point Playwright at the page target (requires CDP attach helper — extend as needed).

## tauri-driver (future)

Official path uses `tauri-driver` + WebDriver. Scaffold lives here; enable when driver binary is on PATH.
