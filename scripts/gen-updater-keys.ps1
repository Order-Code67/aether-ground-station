# Generate Tauri updater keypair (Ed25519) for V2.1 CDN releases.
# Does NOT commit private key. Put pubkey into tauri.conf.json plugins.updater.pubkey.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root "secrets\updater"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$tauri = Join-Path $Root "node_modules\@tauri-apps\cli\tauri.js"
if (-not (Test-Path $tauri)) {
  Write-Host "Installing @tauri-apps/cli locally if needed..."
  Push-Location $Root
  npm install --no-save @tauri-apps/cli 2>$null
  Pop-Location
}

Write-Host "Generating keys via: npx tauri signer generate"
Push-Location $Root
npx --yes @tauri-apps/cli signer generate -w (Join-Path $Out "updater.key")
Pop-Location

Write-Host ""
Write-Host "Private key: $Out\updater.key  (KEEP OUT OF GIT)"
Write-Host "Public key printed above → paste into tauri.conf.json plugins.updater.pubkey"
Write-Host "Manifest template: docs/updater/latest.json.example"
