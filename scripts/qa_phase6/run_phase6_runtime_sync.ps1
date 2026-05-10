#Requires -Version 5.1
<#
.SYNOPSIS
  Phase 6 runtime sync orchestrator.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [int]$SmokeRuns = 2,
  [int]$CycleRuns = 2,
  [int]$StressRuns = 1,
  [switch]$SkipExecution = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Write-PhaseLog {
  param([string]$Message)
  Write-Host "[PHASE6] $(Get-Date -Format 'HH:mm:ss') $Message"
}

Push-Location $ProjectRoot
try {
  if (-not $SkipExecution) {
    Write-PhaseLog 'Running runtime sync loops on device...'
    $phase5Args = @(
      '-ExecutionPolicy', 'Bypass',
      '-File', 'scripts/qa_phase5/run_phase5_runtime_stabilization.ps1',
      '-SmokeRuns', $SmokeRuns,
      '-CycleRuns', $CycleRuns,
      '-StressRuns', $StressRuns
    )

    if ($AdbName) {
      $phase5Args += @('-AdbName', $AdbName)
    }

    & powershell @phase5Args
  }

  Write-PhaseLog 'Generating phase6 runtime sync reports...'
  & node "scripts/qa_phase6/analyze_runtime_sync.js"
  Write-PhaseLog 'Phase 6 runtime sync artifacts ready.'
} finally {
  Pop-Location
}
