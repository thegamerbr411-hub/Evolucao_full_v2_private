#Requires -Version 5.1
<#
.SYNOPSIS
  Phase 7 memory/leak/lifecycle forensics orchestrator.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [int]$SmokeRuns = 1,
  [int]$CycleRuns = 1,
  [int]$StressRuns = 1,
  [switch]$SkipExecution = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Write-PhaseLog {
  param([string]$Message)
  Write-Host "[PHASE7] $(Get-Date -Format 'HH:mm:ss') $Message"
}

Push-Location $ProjectRoot
try {
  if (-not $SkipExecution) {
    Write-PhaseLog 'Running phase6 runtime sync loops as forensic source...'
    $phase6Args = @(
      '-ExecutionPolicy', 'Bypass',
      '-File', 'scripts/qa_phase6/run_phase6_runtime_sync.ps1',
      '-SmokeRuns', $SmokeRuns,
      '-CycleRuns', $CycleRuns,
      '-StressRuns', $StressRuns
    )

    if ($AdbName) {
      $phase6Args += @('-AdbName', $AdbName)
    }

    & powershell @phase6Args
  }

  Write-PhaseLog 'Generating phase7 runtime forensics reports...'
  & node 'scripts/qa_phase7/analyze_runtime_forensics.js'
  Write-PhaseLog 'Phase 7 runtime forensics artifacts ready.'
} finally {
  Pop-Location
}
