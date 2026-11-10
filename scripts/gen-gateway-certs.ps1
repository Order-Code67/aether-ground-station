# Self-signed TLS for Gateway (Windows, no OpenSSL required).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root "services\gateway-server\certs"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$cert = New-SelfSignedCertificate `
  -DnsName "localhost","127.0.0.1" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears(2) `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -HashAlgorithm SHA256

$pwd = ConvertTo-SecureString -String "ags-dev-only" -Force -AsPlainText
$pfx = Join-Path $Out "server.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pwd | Out-Null

# Export CER (public)
$cerPath = Join-Path $Out "server.cer"
Export-Certificate -Cert $cert -FilePath $cerPath -Type CERT | Out-Null

# Convert PFX → PEM via .NET for Node https
Add-Type -AssemblyName System.Security
$pfxBytes = [System.IO.File]::ReadAllBytes($pfx)
$flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable -bor `
         [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet
$x509 = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxBytes, "ags-dev-only", $flags)

$certPem = "-----BEGIN CERTIFICATE-----`n" + `
  [Convert]::ToBase64String($x509.RawData, [System.Base64FormattingOptions]::InsertLineBreaks) + `
  "`n-----END CERTIFICATE-----`n"
[System.IO.File]::WriteAllText((Join-Path $Out "server.crt"), $certPem)

# Private key export (RSA)
$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($x509)
if (-not $rsa) { throw "Cannot export RSA private key" }
$keyBytes = $rsa.ExportPkcs8PrivateKey()
$keyB64 = [Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
$keyPem = "-----BEGIN PRIVATE KEY-----`n$keyB64`n-----END PRIVATE KEY-----`n"
[System.IO.File]::WriteAllText((Join-Path $Out "server.key"), $keyPem)

# Cleanup store copy
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue

Write-Host "OK: $Out\server.crt / server.key"
Write-Host 'Start: $env:GATEWAY_TLS=1; npm run gateway:stub'
