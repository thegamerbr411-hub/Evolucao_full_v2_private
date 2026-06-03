param(
  [string]$Root = "f:\projetos\evolucao app"
)

$ErrorActionPreference = "Stop"
$renderFile = Join-Path $Root "render.yaml"

if (-not (Test-Path $renderFile)) {
  Write-Error "render.yaml nao encontrado: $renderFile"
  exit 1
}

$content = Get-Content $renderFile -Raw
$checks = @(
  @{ Name = "service name evolucao-api"; Pattern = "name:\s*evolucao-api" },
  @{ Name = "rootDir backend"; Pattern = "rootDir:\s*backend" },
  @{ Name = "buildCommand npm install"; Pattern = "buildCommand:\s*npm install" },
  @{ Name = "startCommand npm start"; Pattern = "startCommand:\s*npm start" },
  @{ Name = "healthCheckPath /health"; Pattern = "healthCheckPath:\s*/health" },
  @{ Name = "JWT_SECRET key"; Pattern = "-\s*key:\s*JWT_SECRET" },
  @{ Name = "PASSWORD_RESET_URL key"; Pattern = "-\s*key:\s*PASSWORD_RESET_URL" }
)

$failed = @()
foreach ($c in $checks) {
  if ($content -match $c.Pattern) {
    Write-Host "[OK] $($c.Name)"
  } else {
    Write-Host "[FAIL] $($c.Name)"
    $failed += $c.Name
  }
}

if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Falhas de configuracao Render:" -ForegroundColor Red
  $failed | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

Write-Host ""
Write-Host "check-render-config: PASS" -ForegroundColor Green
exit 0
