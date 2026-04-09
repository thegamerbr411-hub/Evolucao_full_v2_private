$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host 'Corrigindo ADB...'
& "$repoRoot\scripts\fix-adb.ps1"

Write-Host 'Corrigindo Java...'
& "$repoRoot\scripts\fix-java.ps1"

Write-Host 'Limpando portas 8081 e 8082...'
try { npx kill-port 8081 | Out-Null } catch { Write-Host '8081 ja livre.' }
try { npx kill-port 8082 | Out-Null } catch { Write-Host '8082 ja livre.' }

Write-Host 'Iniciando Metro...'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$repoRoot'; npx expo start --dev-client --clear"

Write-Host 'Aplicando adb reverse...'
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082

Write-Host 'Buildando e abrindo app Android...'
npx expo run:android --no-bundler

Write-Host 'Ambiente dev pronto.'
