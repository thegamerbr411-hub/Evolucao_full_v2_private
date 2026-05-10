param(
  [string]$Root = "f:\projetos\evolucao app"
)

$ErrorActionPreference = "Stop"

$backendEnvPath = Join-Path $Root "backend\.env"
$renderPath = Join-Path $Root "render.yaml"

if (-not (Test-Path $backendEnvPath)) {
  Write-Host "[WARN] backend/.env ausente. Validando apenas render.yaml"
}
if (-not (Test-Path $renderPath)) {
  Write-Error "render.yaml ausente"
  exit 1
}

$requiredBackend = @(
  "JWT_SECRET",
  "RESEND_API_KEY",
  "PASSWORD_RESET_URL"
)

$requiredApp = @(
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID"
)

$envText = if (Test-Path $backendEnvPath) { Get-Content $backendEnvPath -Raw } else { "" }
$renderText = Get-Content $renderPath -Raw

$fail = @()

foreach ($k in $requiredBackend) {
  $inEnv = $envText -match "(?m)^\s*$k\s*=\s*.+$"
  $inRender = $renderText -match "-\s*key:\s*$k\b"
  if ($inEnv -or $inRender) {
    Write-Host "[OK] $k"
  } else {
    Write-Host "[FAIL] $k"
    $fail += $k
  }
}

$appEnvPath = Join-Path $Root ".env"
$appEnvText = if (Test-Path $appEnvPath) { Get-Content $appEnvPath -Raw } else { "" }
foreach ($k in $requiredApp) {
  $present = $appEnvText -match "(?m)^\s*$k\s*=\s*.+$"
  if ($present) {
    Write-Host "[OK] $k"
  } else {
    Write-Host "[WARN] $k nao encontrado em .env (pode estar no CI/EAS)"
  }
}

if ($fail.Count -gt 0) {
  Write-Host ""
  Write-Host "Variaveis criticas ausentes:" -ForegroundColor Red
  $fail | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

Write-Host ""
Write-Host "check-env: PASS (backend essentials presentes em env ou render)" -ForegroundColor Green
exit 0
