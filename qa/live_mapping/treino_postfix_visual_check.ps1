#Requires -Version 5.1
<#
.SYNOPSIS
  Validacao visual bounded pos-fix Treino (max 8 PNG, 120s).
#>
param(
  [string]$Serial = 'emulator-5554',
  [string]$RepoRoot = '',
  [switch]$SkipRelaunch,
  [int]$MaxScriptSec = 120,
  [int]$XmlTimeoutSec = 10
)

$ErrorActionPreference = 'Continue'
$script:Deadline = (Get-Date).AddSeconds($MaxScriptSec)
$script:XmlDumpCount = 0
$script:MaxXmlDumps = 6

function Test-ScriptTimeBudget {
  if ((Get-Date) -gt $script:Deadline) {
    Write-Host "TIME_BUDGET_EXCEEDED (${MaxScriptSec}s) - abort"
    exit 4
  }
}

if ($Serial -notmatch '^emulator-') { throw "EMULATOR-ONLY: $Serial" }
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

$env:EVOLUCAO_QA_TARGET = 'emulator'
$env:ADB_DEVICE = $Serial
. (Join-Path $RepoRoot 'tools\lib\AndroidQaTarget.ps1')

$OutDir = Join-Path $PSScriptRoot 'screenshots\treino_postfix'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$script:QaSessionLogPath = Join-Path $OutDir 'treino_postfix_run.log'
if (Test-Path $script:QaSessionLogPath) { Remove-Item $script:QaSessionLogPath -Force }
Write-QaLog "=== treino_postfix_visual_check Serial=$Serial MaxSec=$MaxScriptSec ==="

function Test-MetroOnline {
  try {
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 4
    $body = $resp.Content
    if ($body -is [byte[]]) { $body = [System.Text.Encoding]::UTF8.GetString($body) }
    return [bool]($body -match 'packager-status:running|running')
  } catch { return $false }
}

$devState = (& adb -s $Serial get-state 2>&1) -join ''
if ($devState -notmatch 'device') {
  Write-Host "DEVICE_NOT_READY ($devState) exit 2"
  exit 2
}

if (-not (Test-MetroOnline)) {
  Write-Host 'METRO_OFFLINE (exit 3)'
  exit 3
}

$sdk = Resolve-AndroidSdk
$metrics = [ordered]@{}
$ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'

$WorkoutNeedles = @(
  'workout-exercise-list-simple',
  'workout-exercise-list-advanced',
  'screen-workout',
  'btn-toggle-workout-mode',
  'Exercicio 1 de',
  'Exercício 1 de'
)

function Test-OnWorkoutScreen {
  param([string]$Xml = '')
  if ([string]::IsNullOrWhiteSpace($Xml)) {
    if ($script:XmlDumpCount -ge $script:MaxXmlDumps) { return $false }
    $script:XmlDumpCount++
    $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
    $Xml = $snap.xml
  }
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $false }
  foreach ($n in $WorkoutNeedles) {
    if ($Xml.Contains($n)) { return $true }
  }
  return $false
}

function Save-PostfixCapture {
  param(
    [string]$Name,
    [string]$Label,
    [switch]$SkipXml
  )
  Test-ScriptTimeBudget
  $pngPath = Join-Path $OutDir ($Name + '.png')
  $pngOk = Save-EmulatorScreenshotExecOut -Sdk $sdk -Serial $Serial -OutPath $pngPath
  $xmlOk = $false
  $dumpTimedOut = $false
  $xml = ''
  if (-not $SkipXml -and $script:XmlDumpCount -lt $script:MaxXmlDumps) {
    $script:XmlDumpCount++
    $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
    $xml = $snap.xml
    $dumpTimedOut = [bool]$snap.timedOut
    $xmlOk = -not [string]::IsNullOrWhiteSpace($xml)
    if ($xmlOk) {
      $xml | Set-Content -Path (Join-Path $OutDir ($Name + '.xml')) -Encoding UTF8
    }
  }
  $entry = [ordered]@{
    label = $Label
    png = "screenshots/treino_postfix/$Name.png"
    pngOk = [bool]$pngOk
    xmlOk = [bool]$xmlOk
    dumpTimedOut = $dumpTimedOut
  }
  $script:metrics[$Name] = $entry
  Write-Host "CAPTURE $Name png=$pngOk xml=$xmlOk label=$Label"
  return @{ pngOk = $pngOk; xml = $xml; xmlOk = $xmlOk; entry = $entry }
}

function Invoke-FastRelaunch {
  adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
  adb -s $Serial shell am force-stop com.tipolt.evolucaofullv2 2>$null | Out-Null
  Start-Sleep -Seconds 1
  adb -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  Start-Sleep -Seconds 24
  Test-ScriptTimeBudget
  $null = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'Boa noite', 'app_bootstrap_ready', 'tab-home') -TimeoutSec 18 -PollIntervalMs 1200
}

function Invoke-GoToWorkout {
  if (Test-OnWorkoutScreen) {
    Write-Host 'Already on workout screen'
    return $true
  }
  Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
  Start-Sleep -Seconds 2
  Test-ScriptTimeBudget
  if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
    $script:XmlDumpCount++
    $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
    $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'btn_home_main_cta') -ClickableOnly
    if (-not $tap.ok) {
      Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab treino | Out-Null
      Start-Sleep -Seconds 2
      if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
        $script:XmlDumpCount++
        $snap2 = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
        $tap2 = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap2.xml -Needles @('Treino de hoje', 'Iniciar treino', 'CONTINUAR TREINO') -ClickableOnly
        if (-not $tap2.ok) { return $false }
      }
    }
  }
  Start-Sleep -Seconds 4
  Test-ScriptTimeBudget
  $onWorkout = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles $WorkoutNeedles -TimeoutSec 16 -PollIntervalMs 1200
  if ($onWorkout) {
    adb -s $Serial shell input swipe 540 1600 540 800 300 2>$null | Out-Null
    Start-Sleep -Seconds 1
  }
  return [bool]$onWorkout
}

function Invoke-EnsureSimpleMode {
  if ($script:XmlDumpCount -ge $script:MaxXmlDumps) { return }
  $script:XmlDumpCount++
  $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
  if ($snap.xml -match 'Modo avancado') {
    Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('btn-toggle-workout-mode', 'Alternar') -ClickableOnly | Out-Null
    Start-Sleep -Seconds 1
  }
}

function Invoke-EnsureAdvancedMode {
  if ($script:XmlDumpCount -ge $script:MaxXmlDumps) { return }
  $script:XmlDumpCount++
  $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
  if ($snap.xml -match 'Modo simples') {
    Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('btn-toggle-workout-mode', 'Alternar') -ClickableOnly | Out-Null
    Start-Sleep -Seconds 1
  }
}

function Invoke-ExpandCoachAndHistory {
  if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
    $script:XmlDumpCount++
    $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
    if ($snap.xml -notmatch 'Historico do exercicio') {
      Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('Dica do Coach', 'coachHint') -ClickableOnly | Out-Null
      Start-Sleep -Seconds 1
    }
  }
  adb -s $Serial shell input swipe 540 1500 540 600 280 2>$null | Out-Null
  Start-Sleep -Seconds 1
}

function Invoke-GoToHistoryScreen {
  Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab treino | Out-Null
  Start-Sleep -Seconds 2
  if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
    $script:XmlDumpCount++
    $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
    $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('btn_open_history', 'Ver historico de treinos', 'Historico', 'Ultimos 7 dias', 'Historico dos Ultimos') -ClickableOnly
    if ($tap.ok) {
      Start-Sleep -Seconds 2
      return $true
    }
  }
  adb -s $Serial shell am start -n com.tipolt.evolucaofullv2/.MainActivity 2>$null | Out-Null
  Start-Sleep -Seconds 2
  return $false
}

function Test-HomeConflictConcluidoContinuar {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $null }
  $hasConcluido = [bool]($Xml -match 'Conclu[ií]do|CONCLU[IÍ]DO')
  $hasContinuar = [bool]($Xml -match 'CONTINUAR TREINO|Continuar treino')
  return @{ concluido = $hasConcluido; continuar = $hasContinuar; conflict = ($hasConcluido -and $hasContinuar) }
}

# --- Run ---
if (-not $SkipRelaunch) {
  Invoke-FastRelaunch
} else {
  adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
}

# 001 Home
$c1 = Save-PostfixCapture -Name 'treino_postfix_001_home_treino_state' -Label 'home_state'
$homeCheck = Test-HomeConflictConcluidoContinuar -Xml $c1.xml
$metrics['treino_postfix_001_home_treino_state']['homeConflict'] = $homeCheck

# 002 Workout simple
$navOk = Invoke-GoToWorkout
$metrics['_navigationWorkout'] = $navOk
Invoke-EnsureSimpleMode
$c2 = Save-PostfixCapture -Name 'treino_postfix_002_treino_inicio_modo_simples' -Label 'workout_simple' -SkipXml:($script:XmlDumpCount -ge $script:MaxXmlDumps)

# 003 Advanced
Invoke-EnsureAdvancedMode
$c3 = Save-PostfixCapture -Name 'treino_postfix_003_treino_modo_avancado' -Label 'workout_advanced' -SkipXml:($script:XmlDumpCount -ge $script:MaxXmlDumps)

# 004 Finish incomplete alert
Test-ScriptTimeBudget
if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
  $script:XmlDumpCount++
  $snapW = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
  $tapFin = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snapW.xml -Needles @('btn-finalizar-treino', 'Finalizar treino') -ClickableOnly
  if (-not $tapFin.ok) {
    Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snapW.xml -Needles @('btn-salvar-parcial', 'Sair e salvar progresso') -ClickableOnly | Out-Null
  }
  Start-Sleep -Seconds 1
}
$c4 = Save-PostfixCapture -Name 'treino_postfix_004_finish_incompleto_alert' -Label 'finish_incomplete_alert' -SkipXml:($script:XmlDumpCount -ge $script:MaxXmlDumps)
$alertOk = [bool]($c4.xml -match 'Treino em andamento')
$metrics['treino_postfix_004_finish_incompleto_alert']['alertVisible'] = $alertOk

# Dismiss alert if present
if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
  $script:XmlDumpCount++
  $snapA = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
  Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snapA.xml -Needles @('Continuar treino', 'CONTINUAR') -ClickableOnly | Out-Null
  Start-Sleep -Seconds 1
}

# 005 History panel on exercise
Invoke-GoToWorkout | Out-Null
Invoke-EnsureAdvancedMode
Invoke-ExpandCoachAndHistory
$c5 = Save-PostfixCapture -Name 'treino_postfix_005_historico_exercicio' -Label 'exercise_history_panel' -SkipXml:($script:XmlDumpCount -ge $script:MaxXmlDumps)
$histPanel = [bool]($c5.xml -match 'Historico do exercicio|workout-exercise-history-panel')
$absurd = [bool]($c5.xml -match '2060|1010')
$metrics['treino_postfix_005_historico_exercicio']['historyPanel'] = $histPanel
$metrics['treino_postfix_005_historico_exercicio']['absurdValues'] = $absurd

# 006 History screen local logs
$histNav = Invoke-GoToHistoryScreen
$c6 = Save-PostfixCapture -Name 'treino_postfix_006_history_screen_local_logs' -Label 'history_screen_local' -SkipXml:($script:XmlDumpCount -ge $script:MaxXmlDumps)
$localPanel = [bool]($c6.xml -match 'Historico de series \(local\)|history-local-logs-panel')
$metrics['treino_postfix_006_history_screen_local_logs']['localPanel'] = $localPanel
$metrics['treino_postfix_006_history_screen_local_logs']['histNavOk'] = $histNav

# 007 Invalid input (optional, time-boxed)
$opt7 = @{ captured = $false; reason = 'time_budget_or_xml_limit' }
Test-ScriptTimeBudget
if ($navOk -and $script:XmlDumpCount -lt ($script:MaxXmlDumps - 1)) {
  Invoke-GoToWorkout | Out-Null
  Invoke-EnsureSimpleMode
  if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
    $script:XmlDumpCount++
    $snapIn = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
    $tapW = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snapIn.xml -Needles @('input-weight', 'btn-save-set') -ClickableOnly
    if ($tapW.ok) {
      adb -s $Serial shell input text '2060' 2>$null | Out-Null
      Start-Sleep -Milliseconds 800
      $c7 = Save-PostfixCapture -Name 'treino_postfix_007_input_invalido_bloqueado' -Label 'invalid_input' -SkipXml
      $opt7.captured = $c7.pngOk
      $opt7.reason = 'png_only'
    }
  }
}
if (-not $opt7.captured) {
  $metrics['treino_postfix_007_input_invalido_bloqueado'] = [ordered]@{
    label = 'not_captured'
    pngOk = $false
    reason = 'covered_by_workoutInputValidation.test.mjs'
  }
}

# 008 Finish fields preserved (optional)
$opt8 = @{ captured = $false; reason = 'covered_by_workoutSetDisplayValue.test.mjs' }
Test-ScriptTimeBudget
if ($navOk) {
  Invoke-GoToWorkout | Out-Null
  Invoke-EnsureSimpleMode
  if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
    $script:XmlDumpCount++
    $snap8 = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
    if ($snap8.xml -match 'input-weight') {
      $c8 = Save-PostfixCapture -Name 'treino_postfix_008_finish_fields_preserved' -Label 'fields_before_save' -SkipXml
      $opt8.captured = $c8.pngOk
    }
  }
}
if (-not $opt8.captured) {
  $metrics['treino_postfix_008_finish_fields_preserved'] = [ordered]@{
    label = 'not_captured'
    pngOk = $false
    reason = $opt8.reason
  }
}

$pngCount = (Get-ChildItem $OutDir -Filter 'treino_postfix_*.png' -ErrorAction SilentlyContinue).Count
$report = [ordered]@{
  timestamp = $ts
  serial = $Serial
  skipRelaunch = [bool]$SkipRelaunch
  metroOnline = $true
  navigationWorkoutOk = [bool]$navOk
  xmlDumpCount = $script:XmlDumpCount
  pngCaptured = $pngCount
  optional007 = $opt7
  optional008 = $opt8
  screens = $metrics
}
$reportPath = Join-Path $OutDir 'treino_postfix_metrics.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8
Write-Host "DONE png=$pngCount xmlDumps=$($script:XmlDumpCount) metrics=$reportPath"
exit $(if ($navOk) { 0 } else { 5 })
