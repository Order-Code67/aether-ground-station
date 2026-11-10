# Download BtbN FFmpeg (win64 gpl-shared) into src-tauri/resources/bin for bundling.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/fetch-ffmpeg.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $Root "src-tauri\resources\bin"
$Tmp = Join-Path $env:TEMP "ags-ffmpeg-fetch"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

$Url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip"
$Zip = Join-Path $Tmp "ffmpeg.zip"

Write-Host "Downloading FFmpeg..."
Write-Host $Url
Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing

Write-Host "Extracting..."
Expand-Archive -Path $Zip -DestinationPath $Tmp -Force

$ffmpeg = Get-ChildItem -Path $Tmp -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
$ffprobe = Get-ChildItem -Path $Tmp -Recurse -Filter "ffprobe.exe" | Select-Object -First 1
if (-not $ffmpeg -or -not $ffprobe) {
  throw "ffmpeg.exe / ffprobe.exe not found in archive"
}

Copy-Item $ffmpeg.FullName (Join-Path $OutDir "ffmpeg.exe") -Force
Copy-Item $ffprobe.FullName (Join-Path $OutDir "ffprobe.exe") -Force

# Copy sibling DLLs from same bin folder (shared build)
$binSrc = $ffmpeg.Directory.FullName
Get-ChildItem -Path $binSrc -Filter "*.dll" | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $OutDir $_.Name) -Force
}

$ver = & (Join-Path $OutDir "ffmpeg.exe") -version 2>&1 | Select-Object -First 1
Write-Host "OK: $OutDir"
Write-Host $ver
Write-Host "Re-run tauri build to embed resources/bin into NSIS."
