#Requires -Version 5.1
<#
.SYNOPSIS
  Full regression suite - semantic Phase 3 + legacy tests.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [switch]$Reuse = $true,
  [string]$DetoxConfiguration = $(if ($env:DETOX_CONFIGURATION) { $env:DETOX_CONFIGURATION } else { 'android.attached.debug' }),
  [string]$SuiteFilter = '',
  [string]$ArtifactsDir = '',
  [switch]$StopOnFail = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = $PSScriptRoot

$AdbExe = (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
if (-not (Test-Path $AdbExe)) { $AdbExe = 'adb' }

$Timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$RunDir = if ($ArtifactsDir) { $ArtifactsDir } else { Join-Path $ProjectRoot "qa_runs\regression\run_$Timestamp" }

foreach ($sub in @('logs', 'screenshots', 'video')) {
  New-Item -ItemType Directory -Path (Join-Path $RunDir $sub) -Force | Out-Null
}

$LogFile = Join-Path $RunDir 'logs\regression.log'
$ReportFile = Join-Path $RunDir 'report.md'

function Write-Log {
  param([string]$Msg, [string]$Level = 'INFO')
  $line = "[$Level] $(Get-Date -Format 'HH:mm:ss') $Msg"
  Write-Host $line
  Add-Content -Path $LogFile -Value $line
}

Write-Log '=== QA REGRESSION SUITE ==='
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

if ($Reuse) {
  $env:DETOX_REUSE_APP = '1'
  $env:DETOX_CLEAR_APP_DATA = '0'
  Write-Log 'Reuse mode enabled.'
}

$env:DETOX_ARTIFACTS_LOCATION = Join-Path $RunDir 'screenshots'

$LogcatFile = Join-Path $RunDir 'logs\logcat.txt'
$logcatArgs = @('logcat', '-v', 'time')
if ($DeviceSerial) { $logcatArgs = @('-s', $DeviceSerial) + $logcatArgs }
$logcatJob = Start-Job -ScriptBlock {
  param($a, $o, $exe) & $exe @a *> $o
} -ArgumentList $logcatArgs, $LogcatFile, $AdbExe

$videoOnDevice = '/sdcard/qa_regression.mp4'
$videoLocal = Join-Path $RunDir 'video\regression.mp4'
$recordJob = $null

if ($DeviceSerial) {
  Write-Log 'Starting screenrecord on device...'
  $recordArgs = @('-s', $DeviceSerial, 'shell', 'screenrecord', '--size', '720x1280', '--bit-rate', '2000000', $videoOnDevice)
  $recordJob = Start-Job -ScriptBlock {
    param($a, $exe) & $exe @a
  } -ArgumentList (,$recordArgs), $AdbExe
}

$allTests = @(
  'e2e/semantic/00-semantic-smoke.e2e.js',
  'e2e/semantic/01-semantic-auth.e2e.js',
  'e2e/semantic/02-semantic-navigation.e2e.js',
  'e2e/semantic/03-semantic-logout.e2e.js',
  'e2e/semantic/04-semantic-qa-health.e2e.js',
  'e2e/01-onboarding.e2e.js',
  'e2e/08-navigation.e2e.js',
  'e2e/13-social-ux-audit.e2e.js',
  'e2e/16-treino-tab-smoke.e2e.js',
  'e2e/18-visual-map-audit.e2e.js',
  'e2e/20-visual-fim.e2e.js',
  'e2e/21-profile-save.e2e.js',
  'e2e/22-paywall-trial.e2e.js'
)

$suiteTests = if ($SuiteFilter) {
  $allTests | Where-Object { $_ -match $SuiteFilter }
} else {
  $allTests
}

$results = New-Object System.Collections.Generic.List[object]
$totalStart = Get-Date
$overallExit = 0
$passCount = 0
$failCount = 0

foreach ($test in $suiteTests) {
  $testName = Split-Path $test -Leaf
  $isLegacy = $test -notmatch 'semantic'
  $suiteLabel = if ($isLegacy) { 'legacy' } else { 'semantic' }
  $testStart = Get-Date
  $testLog = Join-Path $RunDir ("logs\" + ($testName -replace '\.e2e\.js$', '.log'))
  $testExit = 0

  Write-Log "[$suiteLabel] Running: $testName"

  try {
    Push-Location $ProjectRoot
    $testFileArg = $test.Replace('/', '\\')
    $jestCommand = '.\\node_modules\\.bin\\jest.cmd --config e2e/jest.config.js --runTestsByPath "' + $testFileArg + '" --forceExit --detectOpenHandles'
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    cmd /c $jestCommand 2>&1 | Tee-Object -FilePath $testLog
    $ErrorActionPreference = $prevErrorAction
    $testExit = $LASTEXITCODE
  } catch {
    Write-Log "Error running ${testName}: $_" 'ERROR'
    $testExit = 1
  } finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
  }

  $dur = ((Get-Date) - $testStart).TotalSeconds
  $status = if ($testExit -eq 0) { 'PASS' } else { 'FAIL' }
  if ($testExit -eq 0) { $passCount++ } else { $failCount++; $overallExit = 1 }

  $results.Add([PSCustomObject]@{
    suite = $suiteLabel
    test = $testName
    status = $status
    duration = [Math]::Round($dur, 1)
    exitCode = $testExit
  })

  Write-Log "$status [$suiteLabel] $testName ${dur}s"

  if ($StopOnFail -and $testExit -ne 0) {
    Write-Log 'StopOnFail - aborting suite.' 'WARN'
    break
  }
}

$totalDur = ((Get-Date) - $totalStart).TotalSeconds

if ($recordJob) {
  Stop-Job -Job $recordJob -ErrorAction SilentlyContinue
  Remove-Job -Job $recordJob -ErrorAction SilentlyContinue
  if ($DeviceSerial) {
    try {
      & $AdbExe -s $DeviceSerial pull $videoOnDevice $videoLocal 2>&1 | Out-Null
      & $AdbExe -s $DeviceSerial shell rm $videoOnDevice 2>&1 | Out-Null
      Write-Log "Video saved: $videoLocal"
    } catch {
      Write-Log 'Could not pull video from device.' 'WARN'
    }
  }
}

Stop-Job -Job $logcatJob -ErrorAction SilentlyContinue
Remove-Job -Job $logcatJob -ErrorAction SilentlyContinue

$overallStatus = if ($overallExit -eq 0) { 'PASS' } else { 'FAIL' }

$tableRows = @()
foreach ($row in $results) {
  $tableRows += "| $($row.suite) | $($row.test) | $($row.status) | $($row.duration)s | $($row.exitCode) |"
}

$reportLines = @(
  '# QA Regression Report - Evolucao App',
  '',
  "**Status:** $overallStatus",
  "**Data:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "**Duracao Total:** $([Math]::Round($totalDur, 1))s",
  "**Device:** $($DeviceSerial -or 'auto-detectado')",
  "**Run dir:** $RunDir",
  '',
  '## Resumo',
  '| Metrica | Valor |',
  '| ------- | ----- |',
  "| Total | $($suiteTests.Count) |",
  "| Passou | $passCount |",
  "| Falhou | $failCount |",
  "| Duracao | $([Math]::Round($totalDur,1))s |",
  '',
  '## Resultados por Teste',
  '| Suite | Teste | Status | Duracao | Exit |',
  '| ----- | ----- | ------ | ------- | ---- |'
)
$reportLines += $tableRows
$reportLines += @(
  '',
  '## Artefatos',
  '- Logs por teste: logs/<nome>.log',
  '- Logcat completo: logs/logcat.txt',
  '- Screenshots: screenshots/',
  '- Video de tela: video/regression.mp4',
  '',
  "## Exit Code: $overallExit"
)

Set-Content -Path $ReportFile -Value $reportLines -Encoding UTF8
Write-Log "Report generated: $ReportFile"
Write-Log "=== REGRESSION DONE - Exit: $overallExit (${passCount} pass, ${failCount} fail) ==="

exit $overallExit
