#Requires -Version 5.1
<#
.SYNOPSIS
  Full QA cycle using semantic tests.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [switch]$Reuse = $true,
  [switch]$ClearData = $false,
  [string]$DetoxConfiguration = $(if ($env:DETOX_CONFIGURATION) { $env:DETOX_CONFIGURATION } else { 'android.attached.debug' }),
  [string]$ArtifactsDir = '',
  [switch]$TestCredentials = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot

$AdbExe = (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
if (-not (Test-Path $AdbExe)) { $AdbExe = 'adb' }

$Timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$RunDir = if ($ArtifactsDir) { $ArtifactsDir } else { Join-Path $ProjectRoot "qa_runs\cycle\run_$Timestamp" }

New-Item -ItemType Directory -Path (Join-Path $RunDir 'logs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $RunDir 'screenshots') -Force | Out-Null

$LogFile = Join-Path $RunDir 'logs\cycle.log'
$ReportFile = Join-Path $RunDir 'report.md'

function Write-Log {
  param([string]$Msg, [string]$Level = 'INFO')
  $line = "[$Level] $(Get-Date -Format 'HH:mm:ss') $Msg"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

Write-Log '=== QA CYCLE RUN ==='
Write-Log "Run dir: $RunDir"

try {
  $adbDevices = & $AdbExe devices 2>&1
} catch {
  Write-Log 'adb not found.' 'ERROR'
  exit 1
}

$DeviceSerial = $AdbName
if (-not $DeviceSerial) {
  $lines = ($adbDevices | Select-String '\tdevice$') -replace '\tdevice', ''
  if ($lines) {
    $physical = $lines | Where-Object { $_ -notmatch 'emulator-' } | Select-Object -First 1
    $DeviceSerial = if ($physical) { $physical.ToString().Trim() } else { ($lines | Select-Object -First 1).ToString().Trim() }
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

if ($ClearData -and $DeviceSerial) {
  Write-Log 'Clearing app data before cycle...'
  & $AdbExe -s $DeviceSerial shell pm clear com.tipolt.evolucaofullv2 | Out-Null
}

if ($Reuse) {
  $env:DETOX_REUSE_APP = '1'
  $env:DETOX_CLEAR_APP_DATA = '0'
  Write-Log 'Reuse mode enabled.'
}

if ($TestCredentials) {
  Write-Log 'Credential mode enabled when QA_TEST_EMAIL/QA_TEST_PASSWORD are present.'
}

$env:DETOX_ARTIFACTS_LOCATION = Join-Path $RunDir 'screenshots'

$LogcatFile = Join-Path $RunDir 'logs\logcat.txt'
$logcatArgs = @('logcat', '-v', 'time', '-s', 'ReactNativeJS:V', 'ReactNative:V', 'EvolucaoQA:V')
if ($DeviceSerial) { $logcatArgs = @('-s', $DeviceSerial) + $logcatArgs }

$logcatJob = Start-Job -ScriptBlock {
  param($argsList, $outFile, $exe)
  & $exe @argsList *> $outFile
} -ArgumentList $logcatArgs, $LogcatFile, $AdbExe

$tests = @(
  'e2e/semantic/00-semantic-smoke.e2e.js',
  'e2e/semantic/01-semantic-auth.e2e.js',
  'e2e/semantic/02-semantic-navigation.e2e.js',
  'e2e/semantic/03-semantic-logout.e2e.js',
  'e2e/semantic/04-semantic-qa-health.e2e.js'
)

$results = New-Object System.Collections.Generic.List[object]
$totalStart = Get-Date
$overallExit = 0

foreach ($test in $tests) {
  $testName = Split-Path $test -Leaf
  $testStart = Get-Date
  $testLog = Join-Path $RunDir ("logs\" + ($testName -replace '\.e2e\.js$', '.log'))
  $testExit = 0

  Write-Log "Running test: $testName"

  try {
    Push-Location $ProjectRoot
    $jestExe = '.\\node_modules\\.bin\\jest.cmd'
    $jestArgs = @(
      '--config', 'e2e/jest.config.js',
      '--runTestsByPath', $test,
      '--forceExit',
      '--detectOpenHandles'
    )
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $jestExe @jestArgs 2>&1 | Tee-Object -FilePath $testLog
    $ErrorActionPreference = $prevErrorAction
    $testExit = $LASTEXITCODE
  } catch {
    Write-Log "Test execution error for ${testName}: $_" 'ERROR'
    $testExit = 1
  } finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
  }

  $duration = ((Get-Date) - $testStart).TotalSeconds
  $status = if ($testExit -eq 0) { 'PASS' } else { 'FAIL' }
  if ($testExit -ne 0) { $overallExit = 1 }

  $results.Add([PSCustomObject]@{
    test = $testName
    status = $status
    duration = [Math]::Round($duration, 1)
    exitCode = $testExit
  })

  Write-Log "$status $testName ${duration}s"
}

$totalDuration = ((Get-Date) - $totalStart).TotalSeconds

Stop-Job -Job $logcatJob -ErrorAction SilentlyContinue
Remove-Job -Job $logcatJob -ErrorAction SilentlyContinue

$overallStatus = if ($overallExit -eq 0) { 'PASS' } else { 'FAIL' }

$tableRows = @()
foreach ($row in $results) {
  $tableRows += "| $($row.test) | $($row.status) | $($row.duration)s | $($row.exitCode) |"
}

$reportLines = @(
  '# QA Cycle Report - Evolucao App',
  '',
  "**Status:** $overallStatus",
  "**Data:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "**Duracao Total:** $([Math]::Round($totalDuration, 1))s",
  "**Device:** $($DeviceSerial -or 'auto-detectado')",
  "**Run dir:** $RunDir",
  '',
  '## Resultados por Teste',
  '| Teste | Status | Duracao | Exit |',
  '| ----- | ------ | ------- | ---- |'
)
$reportLines += $tableRows
$reportLines += @(
  '',
  '## Artefatos',
  '- Logs individuais: logs/<test-name>.log',
  '- Logcat: logs/logcat.txt',
  '- Screenshots: screenshots/',
  '',
  "## Exit Code: $overallExit"
)

Set-Content -Path $ReportFile -Value $reportLines -Encoding UTF8
Write-Log "Report generated: $ReportFile"
Write-Log "=== QA CYCLE DONE - Exit: $overallExit ==="

exit $overallExit
