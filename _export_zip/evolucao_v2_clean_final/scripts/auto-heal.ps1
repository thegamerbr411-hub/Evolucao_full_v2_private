Write-Host "🔧 Auto-healing ambiente..."

$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
if (Test-Path $adbPath) {
  $env:PATH += ";$adbPath"
}

try { adb kill-server } catch {}
try { adb start-server } catch {}

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process adb -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "✅ Ambiente restaurado"
