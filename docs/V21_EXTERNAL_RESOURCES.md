# V2.1 — External resources build guide

## 1. Bundled FFmpeg

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch-ffmpeg.ps1
```

Copies `ffmpeg.exe` / `ffprobe.exe` (+ DLLs) → `src-tauri/resources/bin/`.  
Desktop resolves **bundled first**, then PATH. NSIS embeds via `bundle.resources`.

## 2. GeoTIFF tiled / Deflate

Rust Terrain Engine samples:

- uncompressed strips/tiles
- Deflate (Adobe-style) tiles/strips via `flate2`

LZW / JPEG / PackBits → explicit N/A message (no invented heights).  
Optional future: GDAL sidecar.

## 3. Central Gateway + PostgreSQL + TLS

```powershell
# TLS certs (dev)
powershell -ExecutionPolicy Bypass -File scripts/gen-gateway-certs.ps1

# Optional PostgreSQL
$env:DATABASE_URL = "postgres://aether:aether@127.0.0.1:5432/aether"
$env:GATEWAY_TLS = "1"
npm run gateway:stub
```

Schema: `services/gateway-server/schema.sql`  
Desktop: Remote → Central Gateway → `http(s)://127.0.0.1:8787`

## 4. Authenticode + Updater CDN

```powershell
powershell -ExecutionPolicy Bypass -File scripts/gen-updater-keys.ps1
# Sign NSIS with signtool (requires purchased cert) — see RELEASE_SIGNING.md
```

Host `docs/updater/latest.json.example` on CDN; set `plugins.updater` endpoints.

## 5. WebRTC relay (signaling)

```powershell
npm run webrtc:relay
```

Signaling only (no media SFU). Video adapter expects `ws://127.0.0.1:8790`.

## 6. Robotics / Aerial / HID

UI modules: monitoring / local status only — **no remote actuator / pilot commands**.

## 7. Playwright + WebView2 (Tauri)

```powershell
npm run test:e2e:tauri
```

Requires built app or `tauri dev` + WebDriver. See `e2e/tauri/README.md`.
