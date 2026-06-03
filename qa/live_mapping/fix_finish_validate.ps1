#Requires -Version 5.1
<#
.SYNOPSIS
  Valida BUG_FINISH — rapido, com timeout hard (nao trava).
.PARAMETER SkipRelaunch
  Nao faz force-stop; use quando app ja esta aberto no emulador.
#>
param(
  [string]$Serial = 'emulator-5554',
  [string]$RepoRoot = '',
  [switch]$SkipRelaunch,
  [int]$MaxScriptSec = 120
)

$ErrorActionPreference = 'Continue'
$script:Deadline = (Get-Date).AddSeconds($MaxScriptSec)

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

$OutDir = Join-Path $PSScriptRoot 'screenshots\fix_p1'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Test-MetroOnline {
  try {
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 3
    $body = $resp.Content
    if ($body -is [byte[]]) { $body = [System.Text.Encoding]::UTF8.GetString($body) }
    return [bool]($body -match 'packager-status:running|running')
  } catch { return $false }
}

if (-not (Test-MetroOnline)) {
  Write-Host 'METRO_OFFLINE (exit 3) - start metro_debug first'
  exit 3
}

$sdk = Resolve-AndroidSdk
$metrics = [ordered]@{}
$ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'

$WorkoutNeedles = @(
  'workout-exercise-list-simple',
  'btn-continuar-treino',
  'btn-salvar-parcial',
  'Fluxo rapido',
  'Exercicio 1 de',
  'Exercício 1 de'
)

function Test-OnWorkoutScreen {
  param([string]$Xml = '')
  if ([string]::IsNullOrWhiteSpace($Xml)) {
    $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
    $Xml = $snap.xml
  }
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $false }
  foreach ($n in $WorkoutNeedles) {
    if ($Xml.Contains($n)) { return $true }
  }
  return $false
}

function Get-FinishMetrics {
  param([string]$Xml)
  $wm = Get-WorkoutUiMetrics -Xml $Xml -ExpectedExerciseTotal 5
  return @{
    fecheEm1Toque = [bool]($Xml -match 'Feche em 1 toque')
    finishButtonVisible = [bool]($Xml -match 'Finalizar treino|btn-finalizar-treino')
    continueButtonVisible = [bool]($Xml -match 'Continuar treino|btn-continuar-treino')
    partialExitVisible = [bool]($Xml -match 'Sair e salvar progresso|Salvar parcial|btn-salvar-parcial')
    progressHintVisible = [bool]($Xml -match 'Continue para completar|Progresso salvo:')
    finishVisibleEarly = [bool](
      ($Xml -match 'Feche em 1 toque') -or
      (($Xml -match 'Finalizar treino|btn-finalizar-treino') -and $wm.seriesTotal -gt 0 -and $wm.seriesDone -lt $wm.seriesTotal)
    )
    workoutMetrics = $wm
  }
}

function Save-FinishCapture {
  param([string]$Name, [string]$Label)
  Test-ScriptTimeBudget
  $step = Save-QaCaptureStep -Sdk $sdk -Serial $Serial -OutDir $OutDir -BaseName $Name -XmlTimeoutSec 8
  $xml = $step.xml
  if (-not $step.xmlOk) { $xml = Get-Content (Join-Path $OutDir ($Name + '.xml')) -Raw -ErrorAction SilentlyContinue }
  $fm = Get-FinishMetrics -Xml ([string]$xml)
  $entry = [ordered]@{
    label = $Label
    png = "screenshots/fix_p1/$Name.png"
    xml = "screenshots/fix_p1/$Name.xml"
    pngOk = $step.pngOk
    xmlOk = $step.xmlOk
    dumpTimedOut = $step.dumpTimedOut
  }
  foreach ($key in $fm.Keys) { $entry[$key] = $fm[$key] }
  $script:metrics[$Name] = $entry
  Write-Host "OK $Name (png=$($step.pngOk) xml=$($step.xmlOk) timeout=$($step.dumpTimedOut))"
  return $entry
}

function Invoke-FastRelaunch {
  adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
  adb -s $Serial shell am force-stop com.tipolt.evolucaofullv2 2>$null | Out-Null
  Start-Sleep -Seconds 1
  adb -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  Start-Sleep -Seconds 28
  Test-ScriptTimeBudget
  $null = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'Boa noite', 'app_bootstrap_ready') -TimeoutSec 20 -PollIntervalMs 1200
}

function Invoke-GoToWorkout {
  if (Test-OnWorkoutScreen) {
    Write-Host 'Already on workout screen'
    return $true
  }
  Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
  Start-Sleep -Seconds 2
  Test-ScriptTimeBudget
  $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
  $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'btn_home_main_cta') -ClickableOnly
  if (-not $tap.ok) {
    Write-Host 'Home CTA tap failed'
    return $false
  }
  Start-Sleep -Seconds 5
  Test-ScriptTimeBudget
  $onWorkout = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles $WorkoutNeedles -TimeoutSec 22 -PollIntervalMs 1500
  if (-not $onWorkout) {
    Write-Host 'Workout screen not confirmed (need workout-specific markers, not Home card)'
    return $false
  }
  adb -s $Serial shell input swipe 540 1800 540 900 350 2>$null | Out-Null
  Start-Sleep -Seconds 1
  return $true
}

$refSrc = Join-Path $OutDir 'fix_005_continuar_treino.png'
$refDst = Join-Path $OutDir 'finish_001_before_or_reference.png'
if (Test-Path $refSrc) {
  Copy-Item -Path $refSrc -Destination $refDst -Force
  Write-Host 'Copied finish_001_before_or_reference from fix_005 (pre-fix reference)'
}

Write-Host "=== fix_finish_validate Serial=$Serial SkipRelaunch=$SkipRelaunch MaxSec=$MaxScriptSec ==="

if (-not $SkipRelaunch) {
  Invoke-FastRelaunch
} else {
  adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
}

$navOk = Invoke-GoToWorkout
if (-not $navOk) {
  Write-Host 'NAV_FAIL - capture anyway; re-run with -SkipRelaunch if workout already open (exit 5)'
}

Save-FinishCapture -Name 'finish_002_after_fix_1_of_17' -Label 'workout_incomplete' | Out-Null

Test-ScriptTimeBudget
$snapW = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
$tapPartial = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snapW.xml -Needles @('btn-salvar-parcial', 'Sair e salvar progresso') -ClickableOnly
if ($tapPartial.ok) {
  Start-Sleep -Seconds 1
  $snapA = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 6
  $tapConfirm = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snapA.xml -Needles @('Sair e salvar') -ClickableOnly
  Start-Sleep -Seconds 2
  Save-FinishCapture -Name 'finish_003_partial_exit_if_available' -Label $(if ($tapConfirm.ok) { 'after_partial_confirm' } else { 'partial_alert_visible' }) | Out-Null
} else {
  Save-FinishCapture -Name 'finish_003_partial_exit_if_available' -Label 'partial_button_not_found' | Out-Null
}

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
Start-Sleep -Seconds 2
Save-FinishCapture -Name 'finish_004_home_after_partial_exit' -Label 'home_after_partial' | Out-Null

$w = $metrics['finish_002_after_fix_1_of_17']
$pass = $true
$reasons = [System.Collections.Generic.List[string]]::new()

if (-not $navOk) { $pass = $false; $reasons.Add('navigation_to_workout_failed') }
if ($w.fecheEm1Toque) { $pass = $false; $reasons.Add('fecheEm1Toque=true') }
if ($w.finishButtonVisible -and $w.workoutMetrics.seriesTotal -gt 0 -and $w.workoutMetrics.seriesDone -lt $w.workoutMetrics.seriesTotal) {
  $pass = $false
  $reasons.Add("finishButtonVisible @ $($w.workoutMetrics.seriesDone)/$($w.workoutMetrics.seriesTotal)")
}
if (-not $w.continueButtonVisible -and -not $w.partialExitVisible -and $navOk) {
  $pass = $false
  $reasons.Add('missing continue/partial CTAs')
}
if ($navOk -and -not $w.progressHintVisible) {
  $reasons.Add('progressHint not detected (warn)')
}

$homeXmlPath = Join-Path $OutDir 'finish_004_home_after_partial_exit.xml'
if (Test-Path $homeXmlPath) {
  $homeXml2 = Get-Content $homeXmlPath -Raw -ErrorAction SilentlyContinue
  if ($homeXml2 -and $homeXml2 -notmatch 'CONTINUAR TREINO' -and $homeXml2 -match 'INICIAR TREINO') {
    $pass = $false
    $reasons.Add('home INICIAR after partial exit')
  }
}

$report = [ordered]@{
  timestamp = $ts
  serial = $Serial
  skipRelaunch = [bool]$SkipRelaunch
  navigationOk = $navOk
  bugFinishPass = $pass
  failReasons = @($reasons)
  screens = $metrics
}
$reportPath = Join-Path $OutDir 'fix_finish_metrics.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8

Write-Host ""
Write-Host "BUG_FINISH pass: $pass"
foreach ($r in $reasons) { Write-Host "  - $r" }
Write-Host "Metrics: $reportPath"

if (-not $navOk) { exit 5 }
exit $(if ($pass) { 0 } else { 1 })
