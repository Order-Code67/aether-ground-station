# Bundled FFmpeg binaries

Populate with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch-ffmpeg.ps1
```

Expected files (Windows):

- `ffmpeg.exe`
- `ffprobe.exe`
- optional `*.dll` (shared build)

Binaries are gitignored; CI/release must run the fetch script before `tauri build`.
