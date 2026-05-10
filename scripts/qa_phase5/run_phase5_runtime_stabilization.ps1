#Requires -Version 5.1
<#
.SYNOPSIS
  Phase 5 runtime stabilization orchestrator.
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
  Write-Host "[PHASE5] $(Get-Date -Format 'HH:mm:ss') $Message"
}

Push-Location $ProjectRoot
try {
  if (-not $SkipExecution) {
    Write-PhaseLog 'Running runtime stabilization loops (phase4 orchestrator backend)...'
    $phase4Args = @(
      '-ExecutionPolicy', 'Bypass',
      '-File', 'scripts/qa_phase4/run_phase4_hardening.ps1',
      '-SmokeRuns', $SmokeRuns,
      '-CycleRuns', $CycleRuns,
      '-StressRuns', $StressRuns,
      '-SkipRegression'
    )

    if ($AdbName) {
      $phase4Args += @('-AdbName', $AdbName)
    }

    & powershell @phase4Args
  }

  Write-PhaseLog 'Generating phase5 runtime reports and qa_metrics...'
  & node "scripts/qa_phase5/analyze_runtime_phase5.js"
  Write-PhaseLog 'Phase 5 runtime stabilization artifacts ready.'
} finally {
  Pop-Location
}
