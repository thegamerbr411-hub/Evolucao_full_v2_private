#Requires -Version 5.1
<#
.SYNOPSIS
  QA Cycle completo — auth, navegação, treinos, perfil, logout com seletores semânticos.
.DESCRIPTION
  Executa a suite de testes semânticos Phase 3 em sequência ordenada.
  Captura logcat, screenshots e gera report.md com resultado por cenário.
  Requisitos: adb no PATH, Detox configurado, device físico conectado.
.PARAMETER AdbName
  Serial do device. Se omitido, usa o primeiro físico detectado pelo adb.
.PARAMETER Reuse
  Se $true, não reinstala o app (modo attached-reuse). Padrão: $true.
.PARAMETER ClearData
  Se $true, limpa dados do app antes de executar (pm clear). Padrão: $false.
.PARAMETER ArtifactsDir
  Diretório raiz para artefatos. Padrão: qa_runs/cycle/run_TIMESTAMP/
.PARAMETER TestCredentials
  Se $true e QA_TEST_EMAIL / QA_TEST_PASSWORD estiverem definidas, inclui teste de login real.
#>

param(
  [string]$AdbName        = $env:DETOX_ADB_NAME,
  [switch]$Reuse          = $true,
  [switch]$ClearData      = $false,
  [string]$ArtifactsDir   = '',
  [switch]$TestCredentials = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ──────────────────────────────────────────────
# Configuração
# ──────────────────────────────────────────────
$ProjectRoot = $PSScriptRoot
$Timestamp   = (Get-Date).ToString('yyyyMMdd_HHmmss')
$RunDir      = if ($ArtifactsDir) { $ArtifactsDir } else { Join-Path $ProjectRoot "qa_runs\cycle\run_$Timestamp" }

New-Item -ItemType Directory -Path (Join-Path $RunDir 'logs')        -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $RunDir 'screenshots') -Force | Out-Null

$LogFile    = Join-Path $RunDir 'logs\cycle.log'
$ReportFile = Join-Path $RunDir 'report.md'

function Write-Log {
  param([string]$Msg, [string]$Level = 'INFO')
  $Line = "[$Level] $(Get-Date -Format 'HH:mm:ss') $Msg"
  Write-Host $Line
  Add-Content -Path $LogFile -Value $Line
}

Write-Log "=== EVOLUÇÃO QA CYCLE RUN ==="
Write-Log "Run dir: $RunDir"

# ──────────────────────────────────────────────
# Detectar device
# ──────────────────────────────────────────────
try { $AdbDevices = & adb devices 2>&1 }
catch { Write-Log "adb não encontrado no PATH." 'ERROR'; exit 1 }

Write-Log "ADB: $($AdbDevices -join ' | ')"

$DeviceSerial = $AdbName
if (-not $DeviceSerial) {
  $Lines = ($AdbDevices | Select-String '\tdevice$') -replace '\tdevice', ''
  $Physical = $Lines | Where-Object { $_ -notmatch 'emulator-' } | Select-Object -First 1
  $DeviceSerial = if ($Physical) { $Physical.ToString().Trim() } else { ($Lines | Select-Object -First 1).ToString().Trim() }
}

if ($DeviceSerial) {
  Write-Log "Device: $DeviceSerial"
  $env:DETOX_ADB_NAME = $DeviceSerial
} else {
  Write-Log "Nenhum device detectado." 'WARN'
}

# ──────────────────────────────────────────────
# Limpar dados (opcional)
# ──────────────────────────────────────────────
if ($ClearData -and $DeviceSerial) {
  Write-Log "Limpando dados do app..."
  $AdbClear = @('-s', $DeviceSerial, 'shell', 'pm', 'clear', 'com.tipolt.evolucaofullv2')
  & adb @AdbClear | Out-Null
  Write-Log "Dados limpos."
}

# ──────────────────────────────────────────────
# Configurar Detox
# ──────────────────────────────────────────────
if ($Reuse) {
  $env:DETOX_REUSE_APP       = '1'
  $env:DETOX_CLEAR_APP_DATA  = '0'
  Write-Log "Modo reuse ativo."
}
$env:DETOX_ARTIFACTS_LOCATION = Join-Path $RunDir 'screenshots'

# ──────────────────────────────────────────────
# Logcat em background
# ──────────────────────────────────────────────
$LogcatFile = Join-Path $RunDir 'logs\logcat.txt'
$LogcatArgs = @('logcat', '-v', 'time', '-s', 'ReactNativeJS:V', 'ReactNative:V', 'EvolucaoQA:V')
if ($DeviceSerial) { $LogcatArgs = @('-s', $DeviceSerial) + $LogcatArgs }

$LogcatJob = Start-Job -ScriptBlock {
  param($Args, $Out) & adb @Args *> $Out
} -ArgumentList $LogcatArgs, $LogcatFile
Write-Log "Logcat job $($LogcatJob.Id) iniciado."

# ──────────────────────────────────────────────
# Definir suite de testes
# ──────────────────────────────────────────────
$SemanticTests = @(
  'e2e/semantic/00-semantic-smoke.e2e.js',
  'e2e/semantic/01-semantic-auth.e2e.js',
  'e2e/semantic/02-semantic-navigation.e2e.js',
  'e2e/semantic/03-semantic-logout.e2e.js',
  'e2e/semantic/04-semantic-qa-health.e2e.js'
)

$Results = @()
$TotalStart = Get-Date
$OverallExit = 0

# ──────────────────────────────────────────────
# Executar testes
# ──────────────────────────────────────────────
foreach ($Test in $SemanticTests) {
  $TestName = Split-Path $Test -Leaf
  Write-Log "▶ Executando: $TestName"
  $TestStart = Get-Date
  $TestLog   = Join-Path $RunDir "logs\$($TestName -replace '\.e2e\.js','.log')"
  $TestExit  = 0

  try {
    Push-Location $ProjectRoot
    & node node_modules/.bin/jest `
      --config e2e/jest.config.js `
      --testPathPattern ([regex]::Escape($Test.Replace('/','\/'))) `
      --forceExit --detectOpenHandles `
      2>&1 | Tee-Object -FilePath $TestLog
    $TestExit = $LASTEXITCODE
  } catch {
    Write-Log "Erro ao executar $TestName: $_" 'ERROR'
    $TestExit = 1
  } finally {
    Pop-Location
  }

  $TestDuration = ((Get-Date) - $TestStart).TotalSeconds
  $StatusIcon   = if ($TestExit -eq 0) { '✅' } else { '❌'; $OverallExit = 1 }

  $Results += [PSCustomObject]@{
    Test     = $TestName
    Status   = $StatusIcon
    Duration = "$([Math]::Round($TestDuration, 1))s"
    ExitCode = $TestExit
  }

  Write-Log "$StatusIcon $TestName — $([Math]::Round($TestDuration,1))s (exit $TestExit)"
}

$TotalDuration = ((Get-Date) - $TotalStart).TotalSeconds

# ──────────────────────────────────────────────
# Parar logcat
# ──────────────────────────────────────────────
Stop-Job  -Job $LogcatJob -ErrorAction SilentlyContinue
Remove-Job -Job $LogcatJob -ErrorAction SilentlyContinue
Write-Log "Logcat parado."

# ──────────────────────────────────────────────
# Gerar report.md
# ──────────────────────────────────────────────
$OverallStatus = if ($OverallExit -eq 0) { '✅ PASSOU' } else { '❌ FALHOU' }
$TableRows = ($Results | ForEach-Object { "| $($_.Test) | $($_.Status) | $($_.Duration) | $($_.ExitCode) |" }) -join "`n"

$ReportContent = @"
# QA Cycle Report — Evolução App

**Status:** $OverallStatus
**Data:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Duração Total:** $([Math]::Round($TotalDuration, 1))s
**Device:** $($DeviceSerial -or 'auto-detectado')
**Run dir:** $RunDir

## Resultados por Teste

| Teste | Status | Duração | Exit |
|-------|--------|---------|------|
$TableRows

## Seletores Semânticos Exercitados

- **Telas:** \`screen_home\`, \`screen_treinos\`, \`screen_profile\`, \`screen_login\`, \`screen_register\`
- **Tabs:** \`tab_home\`, \`tab_treinos\`, \`tab_profile\`, \`tab_nutricao\`, \`tab_coach\`, \`tab_social\`
- **Botões:** \`btn_login\`, \`btn_logout\`, \`btn_start_workout\`, \`btn_go_login\`, \`btn_go_register\`
- **Inputs:** \`input_email\`, \`input_password\`, \`input_name\`
- **Bootstrap:** \`app_root\`, \`app_bootstrap_ready\`
- **Debug:** \`screen_debug_health\`, \`qa_health_export\`

## Artefatos

- Logs individuais: \`logs/<test-name>.log\`
- Logcat: \`logs/logcat.txt\`
- Screenshots: \`screenshots/\`

## Exit Code: $OverallExit
"@

Set-Content -Path $ReportFile -Value $ReportContent -Encoding UTF8
Write-Log "Report: $ReportFile"
Write-Log "=== QA CYCLE CONCLUÍDO — Exit: $OverallExit ==="
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host " RESULTADO: $OverallStatus"
Write-Host " Duração:   $([Math]::Round($TotalDuration,1))s"
Write-Host " Report:    $ReportFile"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $OverallExit
