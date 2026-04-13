$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host 'Corrigindo ADB...'
& "$repoRoot\scripts\fix-adb.ps1"

Write-Host 'Corrigindo Java...'
& "$repoRoot\scripts\fix-java.ps1"

function Stop-ListeningPort {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
      if ($connection.OwningProcess) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {
    Write-Host "Porta $Port ja livre."
  }
}

Write-Host 'Limpando portas 3000, 8081 e 8082...'
Stop-ListeningPort -Port 3000
Stop-ListeningPort -Port 8081
Stop-ListeningPort -Port 8082

Write-Host 'Iniciando dashboard QA local...'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$repoRoot'; node dashboard/server.js"

Write-Host 'Iniciando Metro...'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$repoRoot'; npx expo start --dev-client --clear"

Write-Host 'Aplicando adb reverse...'
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

Write-Host 'Buildando e abrindo app Android...'
npx expo run:android --no-bundler

Write-Host 'Ambiente dev pronto.'
