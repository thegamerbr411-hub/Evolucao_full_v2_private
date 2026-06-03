param(
  [string]$Root = "f:\projetos\evolucao app",
  [string]$BackendUrl = "",
  [switch]$Strict
)

$ErrorActionPreference = "Stop"

function Run-Check {
  param(
    [string]$Name,
    [string]$Command
  )
  Write-Host ""
  Write-Host "==> $Name"
  iex $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name falhou"
  }
}

try {
  Run-Check -Name "check-render-config" -Command "& '$Root\scripts\check-render-config.ps1' -Root '$Root'"
  Run-Check -Name "check-oauth" -Command "& '$Root\scripts\check-oauth.ps1' -Root '$Root'"
  Run-Check -Name "check-env" -Command "& '$Root\scripts\check-env.ps1' -Root '$Root'"

  if (-not [string]::IsNullOrWhiteSpace($BackendUrl)) {
    Write-Host ""
    Write-Host "==> health check remoto: $BackendUrl/health"
    $healthUri = $BackendUrl.TrimEnd('/') + '/health'
    $response = $null
    try {
      $response = Invoke-RestMethod -Uri $healthUri -Method Get -TimeoutSec 45
    } catch {
      Write-Host "[WARN] primeira tentativa de health falhou. Repetindo com timeout maior para spin-up..."
      $response = Invoke-RestMethod -Uri $healthUri -Method Get -TimeoutSec 120
    }
    if (-not $response.ok) {
      throw "health remoto sem ok=true"
    }
    Write-Host "[OK] health remoto"
  } elseif ($Strict) {
    throw "BackendUrl obrigatorio em modo -Strict"
  } else {
    Write-Host ""
    Write-Host "[WARN] BackendUrl nao informado. Health remoto nao validado."
  }

  Write-Host ""
  Write-Host "check-infra: PASS" -ForegroundColor Green
  exit 0
}
catch {
  Write-Host ""
  Write-Host "check-infra: FAIL -> $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
