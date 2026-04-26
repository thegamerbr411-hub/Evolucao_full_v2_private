param(
  [int]$Cycles = 15,
  [int]$StabilityCycles = 10,
  [switch]$MobileOnly,
  [switch]$WebOnly,
  [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

$argsList = @(
  'scripts/full-visual-qa.js',
  "--cycles=$Cycles",
  "--stability-cycles=$StabilityCycles"
)

if ($MobileOnly) { $argsList += '--mobile-only' }
if ($WebOnly) { $argsList += '--web-only' }
if ($SkipZip) { $argsList += '--skip-zip' }

Write-Host "[full-visual-qa] running with cycles=$Cycles stability=$StabilityCycles"
& node @argsList
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-Host '[full-visual-qa] finished with failures' -ForegroundColor Red
  exit $exitCode
}

Write-Host '[full-visual-qa] completed successfully' -ForegroundColor Green
