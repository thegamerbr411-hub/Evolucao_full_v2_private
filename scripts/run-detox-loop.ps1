param(
  [int]$Hours = 8,
  [int]$CooldownMs = 10000,
  [string]$Configuration = 'android.emulator.debug',
  [string]$PersonaSequence = 'iniciante,maromba,dieta'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$env:DETOX_CONFIGURATION = $Configuration
$env:QA_LOOP_HOURS = [string]$Hours
$env:QA_LOOP_COOLDOWN_MS = [string]$CooldownMs
$env:QA_PERSONA_SEQUENCE = $PersonaSequence

node scripts/run-detox-loop.js
