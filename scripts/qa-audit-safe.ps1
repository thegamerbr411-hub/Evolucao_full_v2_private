param(
  [string]$DeviceSerial = 'RQ8T209ZTAF',
  [switch]$SkipScrcpy,
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path "$PSScriptRoot\..").Path

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outDir = Join-Path (Get-Location) "qa\manual_audit_$timestamp"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

Write-Output "[audit-safe] output=$outDir"

function Get-ScrcpyPath {
  $fixed = 'C:\Users\USER\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v3.3.4\scrcpy.exe'
  if (Test-Path $fixed) { return $fixed }

  $cmd = Get-Command scrcpy -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  return $null
}

function Get-AdbPath {
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $localSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
  if (Test-Path $localSdk) { return $localSdk }

  $androidHome = $env:ANDROID_HOME
  if ($androidHome) {
    $homeSdk = Join-Path $androidHome 'platform-tools\adb.exe'
    if (Test-Path $homeSdk) { return $homeSdk }
  }

  return $null
}

$adbPath = Get-AdbPath
if (-not $adbPath) {
  throw '[audit-safe] adb nao encontrado no PATH.'
}

$resolvedSerial = $null
$devicesRaw = & $adbPath devices
$deviceLines = @($devicesRaw | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" })

if ($deviceLines.Count -gt 0) {
  $exact = $deviceLines | Where-Object { $_ -match "^$([regex]::Escape($DeviceSerial))\tdevice$" } | Select-Object -First 1
  if ($exact) {
    $resolvedSerial = $DeviceSerial
  } else {
    $resolvedSerial = ($deviceLines[0] -split "\t")[0]
    Write-Output "[audit-safe] serial solicitado nao encontrado; usando $resolvedSerial"
  }
} else {
  Write-Output '[audit-safe] nenhum device conectado; etapas mobile serao ignoradas.'
}

if (-not $SkipScrcpy -and $resolvedSerial) {
  $scrcpyPath = Get-ScrcpyPath
  if (-not $scrcpyPath) {
    throw '[audit-safe] scrcpy nao encontrado (nem path fixo, nem PATH).'
  }

  Write-Output "[audit-safe] abrindo scrcpy: $scrcpyPath"
  Start-Process -FilePath $scrcpyPath -ArgumentList @(
    '--serial', $resolvedSerial,
    '--window-title', 'Evolucao Live Audit',
    '--window-x', '1050',
    '--window-y', '60',
    '--window-width', '430',
    '--stay-awake',
    '--no-audio'
  ) | Out-Null
}

$logProc = $null
if ($resolvedSerial) {
  # Start focused log capture
  $logFile = Join-Path $outDir 'audit_logcat_focus.log'
  Write-Output "[audit-safe] capturando logs em $logFile"
  $logProc = Start-Process -FilePath 'powershell' -ArgumentList @(
    '-NoProfile',
    '-Command',
    "& '$adbPath' -s $resolvedSerial logcat -v time ReactNativeJS:I AndroidRuntime:E *:S | Out-File -FilePath '$logFile' -Encoding utf8"
  ) -PassThru
}

if (-not $SkipTests) {
  Write-Output '[audit-safe] rodando testes estaveis com Node 20...'
  & npx -y node@20 scripts/run-node-tests.js `
    __tests__/workoutFlow.test.mjs `
    __tests__/workoutPersistenceFlow.test.mjs `
    __tests__/nutritionService.test.mjs `
    __tests__/socialUxVariations.integration.test.mjs `
    __tests__/releaseReadinessBaseline.integrity.test.mjs

  if ($LASTEXITCODE -ne 0) {
    Write-Output '[audit-safe] testes falharam. encerrando captura de log.'
    if ($logProc) {
      try { Stop-Process -Id $logProc.Id -Force } catch {}
    }
    exit 1
  }
}

Write-Output '[audit-safe] pronto. execute auditoria manual no app com scrcpy aberto.'
if ($logProc) {
  Write-Output "[audit-safe] para encerrar logs: Stop-Process -Id $($logProc.Id)"
}
Write-Output "[audit-safe] pasta de evidencias: $outDir"
