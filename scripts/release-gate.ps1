param(
  [switch]$SkipRemoteSmoke
)

$ErrorActionPreference = 'Stop'

function Step([string]$Name) {
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
}

Step 'Check env essencial'
powershell -ExecutionPolicy Bypass -File scripts/check-env.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Step 'Preflight operacional (infra + oauth + pipeline)'
node scripts/ops-preflight.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Step 'Smoke local backend'
npm run test:basic
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipRemoteSmoke) {
  Step 'Smoke remoto Render'
  powershell -ExecutionPolicy Bypass -File scripts/ops-health-smoke.ps1
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Step 'Gate final'
Write-Host '[PASS] Gate de release aprovado' -ForegroundColor Green
exit 0
