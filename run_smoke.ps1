#Requires -Version 5.1
<#
.SYNOPSIS
  Smoke QA run for quick app readiness validation.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [switch]$Reuse = $true,
  [string]$DetoxConfiguration = $(if ($env:DETOX_CONFIGURATION) { $env:DETOX_CONFIGURATION } else { 'android.attached.debug' }),
  [string]$ArtifactsDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot

$AdbExe = (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
if (-not (Test-Path $AdbExe)) { $AdbExe = 'adb' }

$Timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$RunDir = if ($ArtifactsDir) { $ArtifactsDir } else { Join-Path $ProjectRoot "qa_runs\smoke\run_$Timestamp" }

New-Item -ItemType Directory -Path (Join-Path $RunDir 'logs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $RunDir 'screenshots') -Force | Out-Null

$LogFile = Join-Path $RunDir 'logs\smoke.log'
$ReportFile = Join-Path $RunDir 'report.md'

function Write-Log {
  param([string]$Msg, [string]$Level = 'INFO')
  $line = "[$Level] $(Get-Date -Format 'HH:mm:ss') $Msg"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

Write-Log '=== QA SMOKE RUN ==='
Write-Log "Run dir: $RunDir"

try {
  $adbDevices = & $AdbExe devices 2>&1
} catch {
  Write-Log 'adb not found.' 'ERROR'
  exit 1
}

$DeviceSerial = $AdbName
if (-not $DeviceSerial) {
  $deviceLines = ($adbDevices | Select-String '\tdevice$') -replace '\tdevice', ''
  if ($deviceLines) {
    $DeviceSerial = ($deviceLines | Select-Object -First 1).ToString().Trim()
  }
}

if ($DeviceSerial) {
  $env:DETOX_ADB_NAME = $DeviceSerial
  Write-Log "Device: $DeviceSerial"
} else {
  Write-Log 'No device serial provided; detox auto-detect mode.' 'WARN'
}

$env:DETOX_CONFIGURATION = $DetoxConfiguration
Write-Log "Detox configuration: $DetoxConfiguration"

if ($Reuse) {
  $env:DETOX_REUSE_APP = '1'
  $env:DETOX_CLEAR_APP_DATA = '0'
  Write-Log 'Reuse mode enabled.'
}

$env:DETOX_ARTIFACTS_LOCATION = Join-Path $RunDir 'screenshots'

$LogcatFile = Join-Path $RunDir 'logs\logcat.txt'
$logcatArgs = @('logcat', '-v', 'time', '-s', 'ReactNativeJS:V', 'ReactNative:V', 'EvolucaoQA:V')
if ($DeviceSerial) { $logcatArgs = @('-s', $DeviceSerial) + $logcatArgs }

$logcatJob = Start-Job -ScriptBlock {
  param($argsList, $outFile, $exe)
  & $exe @argsList *> $outFile
} -ArgumentList $logcatArgs, $LogcatFile, $AdbExe

$testPath = 'e2e/semantic/00-semantic-smoke.e2e.js'
$startTime = Get-Date
$exitCode = 0

try {
  Push-Location $ProjectRoot
  $jestExe = '.\\node_modules\\.bin\\jest.cmd'
  $jestArgs = @(
    '--config', 'e2e/jest.config.js',
    '--runTestsByPath', $testPath,
    '--forceExit',
    '--detectOpenHandles'
  )
  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $jestExe @jestArgs 2>&1 | Tee-Object -FilePath (Join-Path $RunDir 'logs\jest-output.txt')
  $ErrorActionPreference = $prevErrorAction
  $exitCode = $LASTEXITCODE
} catch {
  Write-Log "Jest execution error: $_" 'ERROR'
  $exitCode = 1
} finally {
  $ErrorActionPreference = 'Stop'
  Pop-Location
}

$duration = ((Get-Date) - $startTime).TotalSeconds

Stop-Job -Job $logcatJob -ErrorAction SilentlyContinue
Remove-Job -Job $logcatJob -ErrorAction SilentlyContinue

$status = if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' }

$reportLines = @(
  '# QA Smoke Report - Evolucao App',
  '',
  "**Status:** $status",
  "**Data:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "**Duracao:** $([Math]::Round($duration, 1))s",
  "**Device:** $($DeviceSerial -or 'auto-detectado')",
  "**Run dir:** $RunDir",
  '',
  '## Testes Executados',
  '- e2e/semantic/00-semantic-smoke.e2e.js - boot + landing',
  '',
  '## Artefatos',
  '- Logs: logs/smoke.log',
  '- Jest output: logs/jest-output.txt',
  '- Logcat: logs/logcat.txt',
  '- Screenshots: screenshots/',
  '',
  "## Exit Code: $exitCode"
)

Set-Content -Path $ReportFile -Value $reportLines -Encoding UTF8
Write-Log "Report generated: $ReportFile"
Write-Log "=== SMOKE DONE - Exit: $exitCode ==="

exit $exitCode
