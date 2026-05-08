#Requires -Version 5.1
<#
.SYNOPSIS
  Smoke QA — verifica rapidamente se o app sobe e a tela inicial é detectável.
.DESCRIPTION
  Executa apenas os testes semânticos 00-* (boot + landing).
  Ideal para CI, pré-push ou validação rápida após alterações leves.
  Requisitos: adb no PATH, Detox configurado, Metro rodando ou app já instalado.
.PARAMETER AdbName
  Serial do device. Se omitido, usa o primeiro device conectado.
.PARAMETER Reuse
  Se $true, não reinstala o app (modo attached-reuse).
.PARAMETER ArtifactsDir
  Diretório onde screenshots e logs serão salvos. Padrão: qa_runs/smoke/
#>

param(
  [string]$AdbName    = $env:DETOX_ADB_NAME,
  [switch]$Reuse      = $true,
  [string]$ArtifactsDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ──────────────────────────────────────────────
# Configuração de ambiente
# ──────────────────────────────────────────────
$ProjectRoot = $PSScriptRoot
$Timestamp   = (Get-Date).ToString('yyyyMMdd_HHmmss')
$RunDir      = if ($ArtifactsDir) { $ArtifactsDir } else { Join-Path $ProjectRoot "qa_runs\smoke\run_$Timestamp" }

New-Item -ItemType Directory -Path (Join-Path $RunDir 'logs')        -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $RunDir 'screenshots') -Force | Out-Null

$LogFile    = Join-Path $RunDir 'logs\smoke.log'
$ReportFile = Join-Path $RunDir 'report.md'

function Write-Log {
  param([string]$Msg, [string]$Level = 'INFO')
  $Line = "[$Level] $(Get-Date -Format 'HH:mm:ss') $Msg"
  Write-Host $Line
  Add-Content -Path $LogFile -Value $Line
}

Write-Log "=== EVOLUÇÃO QA SMOKE RUN ==="
Write-Log "Run dir: $RunDir"

# ──────────────────────────────────────────────
# Verificar adb + device
# ──────────────────────────────────────────────
try {
  $AdbDevices = & adb devices 2>&1
  Write-Log "ADB devices: $($AdbDevices -join ' | ')"
} catch {
  Write-Log "adb não encontrado no PATH. Verifique ANDROID_HOME." 'ERROR'
  exit 1
}

$DeviceSerial = $AdbName
if (-not $DeviceSerial) {
  $DeviceLines = ($AdbDevices | Select-String '\tdevice$') -replace '\tdevice', ''
  if ($DeviceLines) {
    $DeviceSerial = ($DeviceLines | Select-Object -First 1).ToString().Trim()
  }
}

if ($DeviceSerial) {
  Write-Log "Device: $DeviceSerial"
  $env:DETOX_ADB_NAME = $DeviceSerial
} else {
  Write-Log "Nenhum device detectado — Detox tentará auto-detectar." 'WARN'
}

# ──────────────────────────────────────────────
# Configurar variáveis Detox
# ──────────────────────────────────────────────
if ($Reuse) {
  $env:DETOX_REUSE_APP  = '1'
  $env:DETOX_CLEAR_APP_DATA = '0'
  Write-Log "Modo reuse: app não reinstalado."
}

$env:DETOX_ARTIFACTS_LOCATION = Join-Path $RunDir 'screenshots'

# ──────────────────────────────────────────────
# Iniciar logcat capture em background
# ──────────────────────────────────────────────
$LogcatFile = Join-Path $RunDir 'logs\logcat.txt'
$LogcatArgs = @('logcat', '-v', 'time', '-s', 'ReactNativeJS:V', 'ReactNative:V', 'EvolucaoQA:V')
if ($DeviceSerial) { $LogcatArgs = @('-s', $DeviceSerial) + $LogcatArgs }

$LogcatJob = Start-Job -ScriptBlock {
  param($AdbArgs, $OutFile)
  & adb @AdbArgs *> $OutFile
} -ArgumentList $LogcatArgs, $LogcatFile

Write-Log "Logcat capturando em background (job $($LogcatJob.Id))..."

# ──────────────────────────────────────────────
# Executar testes semânticos de smoke
# ──────────────────────────────────────────────
$StartTime = Get-Date
$TestPattern = 'e2e/semantic/00-semantic-smoke.e2e.js'
$ExitCode   = 0

Write-Log "Executando: jest --testPathPattern='$TestPattern'"

try {
  Push-Location $ProjectRoot
  & node node_modules/.bin/jest `
    --config e2e/jest.config.js `
    --testPathPattern $TestPattern `
    --forceExit `
    --detectOpenHandles `
    2>&1 | Tee-Object -FilePath (Join-Path $RunDir 'logs\jest-output.txt')
  $ExitCode = $LASTEXITCODE
} catch {
  Write-Log "Erro ao executar jest: $_" 'ERROR'
  $ExitCode = 1
} finally {
  Pop-Location
}

$Duration = ((Get-Date) - $StartTime).TotalSeconds

# ──────────────────────────────────────────────
# Parar logcat
# ──────────────────────────────────────────────
Stop-Job -Job $LogcatJob -ErrorAction SilentlyContinue
Remove-Job -Job $LogcatJob -ErrorAction SilentlyContinue
Write-Log "Logcat parado."

# ──────────────────────────────────────────────
# Gerar report.md
# ──────────────────────────────────────────────
$Status = if ($ExitCode -eq 0) { '✅ PASSOU' } else { '❌ FALHOU' }
$ReportContent = @"
# QA Smoke Report — Evolução App

**Status:** $Status
**Data:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Duração:** $([Math]::Round($Duration, 1))s
**Device:** $($DeviceSerial -or 'auto-detectado')
**Run dir:** $RunDir

## Testes Executados

- \`e2e/semantic/00-semantic-smoke.e2e.js\` — boot e landing por ID semântico

## Seletores Semânticos Validados

- \`app_root\` / \`app_bootstrap_ready\`
- \`screen_home\` / \`screen_login\` / \`screen_register\`

## Artefatos

- Logs: \`logs/smoke.log\`
- Jest output: \`logs/jest-output.txt\`
- Logcat: \`logs/logcat.txt\`
- Screenshots: \`screenshots/\`

## Exit Code: $ExitCode
"@

Set-Content -Path $ReportFile -Value $ReportContent -Encoding UTF8
Write-Log "Report gerado: $ReportFile"
Write-Log "=== SMOKE CONCLUÍDO — Exit: $ExitCode ==="

exit $ExitCode
