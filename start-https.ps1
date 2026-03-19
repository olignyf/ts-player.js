param(
  [int]$Port = 8444,
  [string]$BindHost = "0.0.0.0"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$certPath = Join-Path $Root "cert.pfx"

# Always (re)create cert.pfx passwordless so this script is truly one-command.
# Note: your browser may show the self-signed cert warning each time because the key changes.
Write-Host "Creating self-signed cert (passwordless cert.pfx) ..."

$cert = New-SelfSignedCertificate `
  -DnsName "localhost" `
  -CertStoreLocation "cert:\CurrentUser\My" `
  -FriendlyName "hls-player-https" `
  -KeyExportPolicy Exportable

# Create a real "empty" SecureString without using ConvertTo-SecureString (it rejects empty strings).
$emptyPass = New-Object System.Security.SecureString

try {
  Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $emptyPass -Force | Out-Null
}
catch {
  # Fallback: try exporting without specifying a password.
  Export-PfxCertificate -Cert $cert -FilePath $certPath -Force | Out-Null
}

# Server.js will pass an empty passphrase only if CERT_PASSPHRASE is set.
$env:CERT_PASSPHRASE = ""

$env:PORT = $Port
$env:HOST = $BindHost

Write-Host "Starting HTTPS server..."
node server.js

