#Requires -Version 5.1
<#
.SYNOPSIS
  Phase 8 production readiness orchestrator with real artifacts.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [switch]$SkipExecution = $false,
  [switch]$SkipVideoTour = $false,
  [switch]$SkipRegression = $false,
  [switch]$SkipAnalyze = $false,
  [switch]$TestCredentials = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$OutRoot = Join-Path $ProjectRoot 'qa_phase8_production_readiness'
$RunsRoot = Join-Path $OutRoot 'QA_RUNS'
$SmokeRunDir = Join-Path $RunsRoot ('smoke\run_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$CycleRunDir = Join-Path $RunsRoot ('cycle\run_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$RegressionRunDir = Join-Path $RunsRoot ('regression\run_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$VideoDir = Join-Path $RunsRoot 'video'
$TourDir = Join-Path $RunsRoot 'tour'
$RuntimeLogsDir = Join-Path $RunsRoot 'runtime_logs'

$AdbExe = (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
if (-not (Test-Path $AdbExe)) { $AdbExe = 'adb' }

function Write-PhaseLog {
  param([string]$Message)
  Write-Host "[PHASE8] $(Get-Date -Format 'HH:mm:ss') $Message"
}

function EnsureDirectory {
  param([string]$Path)
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Resolve-Device {
  param([string]$Requested)

  if ($Requested) {
    return $Requested
  }

  try {
    $raw = & $AdbExe devices 2>$null
    $devices = ($raw | Select-String '\tdevice$') -replace '\tdevice', ''
    if ($devices) {
      return ($devices | Select-Object -First 1).ToString().Trim()
    }
  } catch {
    return ''
  }

  return ''
}

EnsureDirectory $OutRoot
EnsureDirectory $RunsRoot
EnsureDirectory $VideoDir
EnsureDirectory $TourDir
EnsureDirectory $RuntimeLogsDir

Push-Location $ProjectRoot
try {
  $resolvedDevice = Resolve-Device -Requested $AdbName
  if ($resolvedDevice) {
    $env:DETOX_ADB_NAME = $resolvedDevice
    Write-PhaseLog "Using device: $resolvedDevice"
  } else {
    Write-PhaseLog 'No explicit device found; keeping Detox auto-detect mode.'
  }

  if (-not $SkipExecution) {
    Write-PhaseLog 'Running smoke real flow...'
    $smokeArgs = @(
      '-ExecutionPolicy', 'Bypass',
      '-File', 'run_smoke.ps1',
      '-ArtifactsDir', $SmokeRunDir
    )
    if ($resolvedDevice) {
      $smokeArgs += @('-AdbName', $resolvedDevice)
    }
    & powershell @smokeArgs

    Write-PhaseLog 'Running cycle real flow...'
    $cycleArgs = @(
      '-ExecutionPolicy', 'Bypass',
      '-File', 'run_qa_cycle.ps1',
      '-ArtifactsDir', $CycleRunDir
    )
    if ($resolvedDevice) {
      $cycleArgs += @('-AdbName', $resolvedDevice)
    }
    if ($TestCredentials) {
      $cycleArgs += '-TestCredentials'
    }
    & powershell @cycleArgs

    if (-not $SkipRegression) {
      Write-PhaseLog 'Running regression flow with video artifact...'
      $regressionArgs = @(
        '-ExecutionPolicy', 'Bypass',
        '-File', 'run_regression.ps1',
        '-ArtifactsDir', $RegressionRunDir
      )
      if ($resolvedDevice) {
        $regressionArgs += @('-AdbName', $resolvedDevice)
      }
      & powershell @regressionArgs
    }

    if (-not $SkipVideoTour) {
      Write-PhaseLog 'Capturing continuous full-app tour video...'
      $videoOnDevice = '/sdcard/phase8_full_real_validation.mp4'
      $videoLocal = Join-Path $VideoDir 'full_real_validation_continuous.mp4'

      $recordArgs = @('shell', 'screenrecord', '--size', '720x1280', '--bit-rate', '2500000', $videoOnDevice)
      if ($resolvedDevice) {
        $recordArgs = @('-s', $resolvedDevice) + $recordArgs
      }

      $recordJob = Start-Job -ScriptBlock {
        param($exe, $argsList)
        & $exe @argsList
      } -ArgumentList $AdbExe, (,$recordArgs)

      try {
        $tourArgs = @(
          '-ExecutionPolicy', 'Bypass',
          '-File', 'tour_completo.ps1'
        )
        if ($resolvedDevice) {
          $tourArgs += @('-Device', $resolvedDevice)
        }

        & powershell @tourArgs
      } finally {
        Stop-Job -Job $recordJob -ErrorAction SilentlyContinue | Out-Null
        Remove-Job -Job $recordJob -ErrorAction SilentlyContinue | Out-Null

        try {
          $pullArgs = @('pull', $videoOnDevice, $videoLocal)
          if ($resolvedDevice) { $pullArgs = @('-s', $resolvedDevice) + $pullArgs }
          & $AdbExe @pullArgs | Out-Null

          $rmArgs = @('shell', 'rm', $videoOnDevice)
          if ($resolvedDevice) { $rmArgs = @('-s', $resolvedDevice) + $rmArgs }
          & $AdbExe @rmArgs | Out-Null
        } catch {
          Write-PhaseLog 'Could not pull continuous tour video from device.'
        }
      }
    }

    Write-PhaseLog 'Collecting logcat runtime snapshot...'
    $logcatOut = Join-Path $RuntimeLogsDir ('phase8_logcat_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.txt')
    $logcatArgs = @('logcat', '-d', '-v', 'time', '-s', 'ReactNativeJS:V', 'ReactNative:V', 'EvolucaoQA:V')
    if ($resolvedDevice) {
      $logcatArgs = @('-s', $resolvedDevice) + $logcatArgs
    }

    try {
      & $AdbExe @logcatArgs *> $logcatOut
    } catch {
      Write-PhaseLog 'Failed to export phase8 runtime logcat snapshot.'
    }
  }

  if (-not $SkipAnalyze) {
    Write-PhaseLog 'Generating phase8 production readiness reports...'
    & node 'scripts/qa_phase8/analyze_production_readiness.js'
  }

  Write-PhaseLog 'Phase 8 production readiness artifacts ready.'
} finally {
  Pop-Location
}
