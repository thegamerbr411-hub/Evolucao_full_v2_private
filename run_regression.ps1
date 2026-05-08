#Requires -Version 5.1
<#
.SYNOPSIS
  Regression Suite completa — suite semântica Phase 3 + suite legada com screenshot e artifacts.
.DESCRIPTION
  Executa TODOS os testes e2e (semânticos + legados numerados) em sequência.
  Captura screenrecord via adb, logcat, screenshots e gera relatório de regressão completo.
  Ideal para validação de releases ou branches de feature antes de merge.
.PARAMETER AdbName
  Serial do device. Se omitido, usa o primeiro físico detectado.
.PARAMETER Reuse
  Se $true, não reinstala o app. Padrão: $true.
.PARAMETER SuiteFilter
  Regex para filtrar quais testes executar. Padrão: '' (todos).
.PARAMETER ArtifactsDir
  Diretório raiz para artefatos. Padrão: qa_runs/regression/run_TIMESTAMP/
.PARAMETER StopOnFail
  Se $true, para a suite no primeiro teste que falhar. Padrão: $false.
#>

param(
  [string]$AdbName      = $env:DETOX_ADB_NAME,
  [switch]$Reuse        = $true,
  [string]$SuiteFilter  = '',
  [string]$ArtifactsDir = '',
  [switch]$StopOnFail   = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ──────────────────────────────────────────────
# Configuração
# ──────────────────────────────────────────────
$ProjectRoot = $PSScriptRoot
$Timestamp   = (Get-Date).ToString('yyyyMMdd_HHmmss')
$RunDir      = if ($ArtifactsDir) { $ArtifactsDir } else { Join-Path $ProjectRoot "qa_runs\regression\run_$Timestamp" }

foreach ($Sub in @('logs','screenshots','video')) {
  New-Item -ItemType Directory -Path (Join-Path $RunDir $Sub) -Force | Out-Null
}

$LogFile    = Join-Path $RunDir 'logs\regression.log'
$ReportFile = Join-Path $RunDir 'report.md'

function Write-Log {
  param([string]$Msg, [string]$Level = 'INFO')
  $Line = "[$Level] $(Get-Date -Format 'HH:mm:ss') $Msg"
  Write-Host $Line
  Add-Content -Path $LogFile -Value $Line
}

Write-Log "=== EVOLUÇÃO QA REGRESSION SUITE ==="
Write-Log "Run dir: $RunDir"

# ──────────────────────────────────────────────
# Detectar device
# ──────────────────────────────────────────────
try { $AdbDevices = & adb devices 2>&1 }
catch { Write-Log "adb não encontrado." 'ERROR'; exit 1 }

$DeviceSerial = $AdbName
if (-not $DeviceSerial) {
  $Lines = ($AdbDevices | Select-String '\tdevice$') -replace '\tdevice',''
  $Physical = $Lines | Where-Object { $_ -notmatch 'emulator-' } | Select-Object -First 1
  $DeviceSerial = if ($Physical) { $Physical.ToString().Trim() }
}

if ($DeviceSerial) {
  Write-Log "Device: $DeviceSerial"
  $env:DETOX_ADB_NAME = $DeviceSerial
} else {
  Write-Log "Nenhum device detectado." 'WARN'
}

# ──────────────────────────────────────────────
# Configurar Detox
# ──────────────────────────────────────────────
if ($Reuse) { $env:DETOX_REUSE_APP = '1'; $env:DETOX_CLEAR_APP_DATA = '0' }
$env:DETOX_ARTIFACTS_LOCATION = Join-Path $RunDir 'screenshots'

# ──────────────────────────────────────────────
# Screenrecord em background (Android)
# ──────────────────────────────────────────────
$VideoOnDevice = '/sdcard/qa_regression.mp4'
$VideoLocal    = Join-Path $RunDir 'video\regression.mp4'
$RecordJob     = $null

if ($DeviceSerial) {
  Write-Log "Iniciando screenrecord no device..."
  $RecordArgs = @('-s', $DeviceSerial, 'shell', 'screenrecord', '--size', '720x1280', '--bit-rate', '2000000', $VideoOnDevice)
  $RecordJob  = Start-Job -ScriptBlock { param($A) & adb @A } -ArgumentList (,$RecordArgs)
  Write-Log "Screenrecord job $($RecordJob.Id) iniciado."
}

# ──────────────────────────────────────────────
# Logcat em background
# ──────────────────────────────────────────────
$LogcatFile = Join-Path $RunDir 'logs\logcat.txt'
$LogcatArgs = @('logcat', '-v', 'time')
if ($DeviceSerial) { $LogcatArgs = @('-s', $DeviceSerial) + $LogcatArgs }
$LogcatJob  = Start-Job -ScriptBlock { param($A,$O) & adb @A *> $O } -ArgumentList $LogcatArgs, $LogcatFile
Write-Log "Logcat job $($LogcatJob.Id) iniciado."

# ──────────────────────────────────────────────
# Suite completa de testes
# ──────────────────────────────────────────────
$AllTests = @(
  # Semânticos Phase 3 (primeiro)
  'e2e/semantic/00-semantic-smoke.e2e.js',
  'e2e/semantic/01-semantic-auth.e2e.js',
  'e2e/semantic/02-semantic-navigation.e2e.js',
  'e2e/semantic/03-semantic-logout.e2e.js',
  'e2e/semantic/04-semantic-qa-health.e2e.js',
  # Legados numerados (regressão)
  'e2e/01-onboarding.e2e.js',
  'e2e/08-navigation.e2e.js',
  'e2e/16-treino-tab-smoke.e2e.js',
  'e2e/21-profile-save.e2e.js'
)

$SuiteTests = if ($SuiteFilter) {
  $AllTests | Where-Object { $_ -match $SuiteFilter }
} else {
  $AllTests
}

Write-Log "Suite: $($SuiteTests.Count) testes"

$Results   = @()
$TotalStart = Get-Date
$OverallExit = 0
$PassCount  = 0
$FailCount  = 0

foreach ($Test in $SuiteTests) {
  $TestName  = Split-Path $Test -Leaf
  $IsLegacy  = $Test -notmatch 'semantic'
  $TestLabel = if ($IsLegacy) { "[LEGADO] $TestName" } else { "[SEMÂNTICO] $TestName" }
  Write-Log "▶ $TestLabel"

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
    Write-Log "Erro: $_" 'ERROR'
    $TestExit = 1
  } finally {
    Pop-Location
  }

  $Dur    = ((Get-Date) - $TestStart).TotalSeconds
  $Icon   = if ($TestExit -eq 0) { '✅'; $PassCount++ } else { '❌'; $FailCount++; $OverallExit = 1 }
  $Suite  = if ($IsLegacy) { 'legado' } else { 'semântico' }

  $Results += [PSCustomObject]@{
    Test     = $TestName
    Suite    = $Suite
    Status   = $Icon
    Duration = "$([Math]::Round($Dur,1))s"
    ExitCode = $TestExit
  }

  Write-Log "$Icon $TestLabel — $([Math]::Round($Dur,1))s"

  if ($StopOnFail -and $TestExit -ne 0) {
    Write-Log "StopOnFail ativo — interrompendo suite." 'WARN'
    break
  }
}

$TotalDur = ((Get-Date) - $TotalStart).TotalSeconds

# ──────────────────────────────────────────────
# Parar jobs de background
# ──────────────────────────────────────────────
if ($RecordJob) {
  Stop-Job  -Job $RecordJob -ErrorAction SilentlyContinue
  Remove-Job -Job $RecordJob -ErrorAction SilentlyContinue
  # Pull vídeo do device
  if ($DeviceSerial) {
    try {
      & adb -s $DeviceSerial pull $VideoOnDevice $VideoLocal 2>&1 | Out-Null
      & adb -s $DeviceSerial shell rm $VideoOnDevice 2>&1 | Out-Null
      Write-Log "Vídeo salvo: $VideoLocal"
    } catch {
      Write-Log "Não foi possível puxar o vídeo do device." 'WARN'
    }
  }
}
Stop-Job  -Job $LogcatJob -ErrorAction SilentlyContinue
Remove-Job -Job $LogcatJob -ErrorAction SilentlyContinue
Write-Log "Jobs de background parados."

# ──────────────────────────────────────────────
# Gerar report.md
# ──────────────────────────────────────────────
$OverallStatus = if ($OverallExit -eq 0) { '✅ PASSOU' } else { '❌ FALHOU' }
$TableRows = ($Results | ForEach-Object { "| $($_.Suite) | $($_.Test) | $($_.Status) | $($_.Duration) | $($_.ExitCode) |" }) -join "`n"

$ReportContent = @"
# QA Regression Report — Evolução App

**Status:** $OverallStatus
**Data:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Duração Total:** $([Math]::Round($TotalDur, 1))s
**Device:** $($DeviceSerial -or 'auto-detectado')
**Run dir:** $RunDir

## Resumo

| Métrica | Valor |
|---------|-------|
| Total | $($SuiteTests.Count) |
| Passou | $PassCount |
| Falhou | $FailCount |
| Duração | $([Math]::Round($TotalDur,1))s |

## Resultados por Teste

| Suite | Teste | Status | Duração | Exit |
|-------|-------|--------|---------|------|
$TableRows

## Artefatos

- Logs por teste: \`logs/<nome>.log\`
- Logcat completo: \`logs/logcat.txt\`
- Screenshots: \`screenshots/\`
- Vídeo de tela: \`video/regression.mp4\`

## Exit Code: $OverallExit
"@

Set-Content -Path $ReportFile -Value $ReportContent -Encoding UTF8
Write-Log "Report: $ReportFile"
Write-Log "=== REGRESSION CONCLUÍDA — Exit: $OverallExit ($PassCount pass, $FailCount fail) ==="
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host " RESULTADO:  $OverallStatus"
Write-Host " Testes:     $PassCount/$($SuiteTests.Count) passaram"
Write-Host " Duração:    $([Math]::Round($TotalDur,1))s"
Write-Host " Report:     $ReportFile"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $OverallExit
