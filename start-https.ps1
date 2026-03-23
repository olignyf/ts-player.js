param(
  [int]$Port = 8444,
  [string]$BindHost = "0.0.0.0"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$certPath = Join-Path $Root "cert.pfx"

if (-not (Test-Path $certPath)) {
  Write-Host "cert.pfx not found. Creating self-signed cert (passwordless cert.pfx) ..."

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
}
else {
  Write-Host "Using existing cert.pfx"
}

# Server.js will pass an empty passphrase only if CERT_PASSPHRASE is set.
$env:CERT_PASSPHRASE = ""

$env:PORT = $Port
$env:HOST = $BindHost

Write-Host "Starting HTTPS server..."
node server.js

