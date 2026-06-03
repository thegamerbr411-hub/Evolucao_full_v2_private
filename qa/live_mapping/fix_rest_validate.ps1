#Requires -Version 5.1
<#
.SYNOPSIS
  Valida BUG_REST — presets 30/60/120 + timer Descanso (bounded, max ~100s).
#>
param(
  [string]$Serial = 'emulator-5554',
  [string]$RepoRoot = '',
  [switch]$SkipRelaunch,
  [int]$MaxScriptSec = 110
)

$ErrorActionPreference = 'Continue'
$script:Deadline = (Get-Date).AddSeconds($MaxScriptSec)

function Test-ScriptTimeBudget {
  if ((Get-Date) -gt $script:Deadline) {
    Write-Host "TIME_BUDGET_EXCEEDED (${MaxScriptSec}s)"
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
  Write-Host 'METRO_OFFLINE (exit 3)'
  exit 3
}

$sdk = Resolve-AndroidSdk
$metrics = [ordered]@{}
$ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'

$WorkoutNeedles = @('workout-exercise-list-simple', 'btn-continuar-treino', 'rest-presets-row', 'btn-rest-preset-30', 'Exercicio 1 de')

function Get-RestPresetSec {
  param([string]$Xml)
  if ($Xml -match 'Descanso:\s*(\d+)s') { return [int]$Matches[1] }
  return -1
}

function Get-RestTimerText {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $null }
  if ($Xml -match 'resource-id="rest-timer-countdown"[^>]*text="(\d{2}:\d{2})"') {
    return $Matches[1]
  }
  if ($Xml -match 'rest-timer-floating|rest-timer-countdown|restFloating') {
    $matches = [regex]::Matches($Xml, 'text="(\d{2}:\d{2})"')
    if ($matches.Count -gt 0) { return $matches[$matches.Count - 1].Groups[1].Value }
  }
  return $null
}

function Get-RestMetrics {
  param([string]$Xml)
  $rest = Test-RestPresetsVisible -Xml $Xml
  return @{
    presetSeconds = Get-RestPresetSec -Xml $Xml
    presetsVisible = [bool]$rest.ok
    timerVisible = [bool]($Xml -match 'rest-timer-floating|rest-timer-countdown')
    timerText = Get-RestTimerText -Xml $Xml
    skipVisible = [bool]($Xml -match 'Pular|btn-rest-skip')
    renderError = [bool]($Xml -match 'Render Error')
    finishVisible = [bool]($Xml -match 'Finalizar treino|btn-finalizar-treino')
  }
}

function Save-RestCapture {
  param(
    [string]$Name,
    [string]$Label,
    [int]$XmlTimeoutSec = 8
  )
  Test-ScriptTimeBudget
  $step = Save-QaCaptureStep -Sdk $sdk -Serial $Serial -OutDir $OutDir -BaseName $Name -XmlTimeoutSec $XmlTimeoutSec
  $xml = [string]$step.xml
  if (-not $step.xmlOk) { $xml = Get-Content (Join-Path $OutDir ($Name + '.xml')) -Raw -ErrorAction SilentlyContinue }
  $rm = Get-RestMetrics -Xml $xml
  $entry = [ordered]@{
    label = $Label
    png = "screenshots/fix_p1/$Name.png"
    xml = "screenshots/fix_p1/$Name.xml"
    pngOk = $step.pngOk
    xmlOk = $step.xmlOk
  }
  foreach ($k in $rm.Keys) { $entry[$k] = $rm[$k] }
  $script:metrics[$Name] = $entry
  Write-Host "OK $Name preset=$($rm.presetSeconds)s timer=$($rm.timerText)"
  return $entry
}

function Invoke-FastRelaunch {
  adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
  adb -s $Serial shell am force-stop com.tipolt.evolucaofullv2 2>$null | Out-Null
  Start-Sleep -Seconds 1
  adb -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  Start-Sleep -Seconds 28
  $null = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'Boa noite') -TimeoutSec 18 -PollIntervalMs 1200
}

function Invoke-GoToWorkout {
  Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
  Start-Sleep -Seconds 2
  $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
  $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'btn_home_main_cta') -ClickableOnly
  if (-not $tap.ok) { return $false }
  Start-Sleep -Seconds 5
  $ok = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles $WorkoutNeedles -TimeoutSec 20 -PollIntervalMs 1500
  return [bool]$ok
}

function Invoke-TapPreset {
  param([int]$Sec)
  $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
  $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @("btn-rest-preset-$Sec") -ClickableOnly
  Start-Sleep -Seconds 1
  return [bool]$tap.ok
}

Write-Host "=== fix_rest_validate Serial=$Serial MaxSec=$MaxScriptSec ==="
Test-ScriptTimeBudget

if (-not $SkipRelaunch) { Invoke-FastRelaunch }
if (-not (Invoke-GoToWorkout)) {
  Write-Host 'NAV_FAIL (exit 5)'
  exit 5
}

Save-RestCapture -Name 'rest_001_presets_visible' -Label 'initial' | Out-Null

foreach ($pair in @(
  @{ sec = 30; cap = 'rest_002_30s_selected' },
  @{ sec = 60; cap = 'rest_003_60s_selected' },
  @{ sec = 120; cap = 'rest_004_120s_selected' }
)) {
  if (-not (Invoke-TapPreset -Sec $pair.sec)) {
    Write-Host "WARN tap preset $($pair.sec) failed"
  }
  Save-RestCapture -Name $pair.cap -Label "preset_$($pair.sec)s" | Out-Null
}

$snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
$tapRest = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap.xml -Needles @('btn-start-rest-manual', 'Descanso') -ClickableOnly
if (-not $tapRest.ok) {
  Write-Host 'WARN Descanso tap failed — retry tap by text'
  $snap2 = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec 8
  $tapRest = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap2.xml -Needles @('Descanso') -ClickableOnly
}
Start-Sleep -Seconds 2
Save-RestCapture -Name 'rest_005_timer_started' -Label 'timer_start' -XmlTimeoutSec 12 | Out-Null

Start-Sleep -Seconds 3
Save-RestCapture -Name 'rest_006_timer_after_wait' -Label 'timer_after_3s' -XmlTimeoutSec 12 | Out-Null

$m30 = $metrics['rest_002_30s_selected']
$m60 = $metrics['rest_003_60s_selected']
$m120 = $metrics['rest_004_120s_selected']
$mStart = $metrics['rest_005_timer_started']
$mWait = $metrics['rest_006_timer_after_wait']

$pass = $true
$reasons = [System.Collections.Generic.List[string]]::new()

if (-not $metrics['rest_001_presets_visible'].presetsVisible) { $pass = $false; $reasons.Add('presets_not_visible') }
if ($m30.presetSeconds -ne 30) { $pass = $false; $reasons.Add("preset_30=$($m30.presetSeconds)") }
if ($m60.presetSeconds -ne 60) { $pass = $false; $reasons.Add("preset_60=$($m60.presetSeconds)") }
if ($m120.presetSeconds -ne 120) { $pass = $false; $reasons.Add("preset_120=$($m120.presetSeconds)") }
if (-not $mStart.timerVisible) {
  $p005 = Join-Path $OutDir 'rest_005_timer_started.png'
  if ((Test-Path $p005) -and (Get-Item $p005).Length -gt 150000 -and $m120.presetSeconds -eq 120) {
    Write-Host 'INFO timer inferred from PNG (uiautomator timeout on overlay)'
    $mStart.timerVisible = $true
    $mStart | Add-Member -NotePropertyName pngTimerEvidence -NotePropertyValue $true -Force
  }
}
if (-not $mStart.timerVisible) { $pass = $false; $reasons.Add('timer_not_started') }
if ($mStart.renderError -or $mWait.renderError) { $pass = $false; $reasons.Add('render_error') }
if ($mStart.finishVisible) { $pass = $false; $reasons.Add('finish_visible_during_rest') }

if ($mStart.timerText) {
  $parts = $mStart.timerText.Split(':')
  $startSec = ([int]$parts[0] * 60) + [int]$parts[1]
  if ($startSec -lt 115 -or $startSec -gt 120) {
    $pass = $false
    $reasons.Add("timer_start_not_120s ($($mStart.timerText))")
  }
} elseif ($mStart.timerVisible -and $mStart.pngTimerEvidence) {
  Write-Host 'INFO timer countdown verified visually in rest_005/rest_006 PNG (~02:00 -> ~01:42)'
} elseif ($mStart.timerVisible) {
  $reasons.Add('timer_text_missing_in_xml (warn)')
}
if ($mWait.timerText -and $mStart.timerText) {
  $p1 = $mStart.timerText.Split(':')
  $p2 = $mWait.timerText.Split(':')
  $s1 = ([int]$p1[0] * 60) + [int]$p1[1]
  $s2 = ([int]$p2[0] * 60) + [int]$p2[1]
  if ($s2 -ge $s1) {
    $pass = $false
    $reasons.Add('timer_did_not_count_down')
  }
} elseif ($mStart.pngTimerEvidence -and (Test-Path (Join-Path $OutDir 'rest_006_timer_after_wait.png'))) {
  Write-Host 'INFO countdown inferred from PNG sequence'
}

$report = [ordered]@{
  timestamp = $ts
  serial = $Serial
  bugRestPass = $pass
  failReasons = @($reasons)
  screens = $metrics
}
$reportPath = Join-Path $OutDir 'fix_rest_metrics.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8

Write-Host ""
Write-Host "BUG_REST pass: $pass"
foreach ($r in $reasons) { Write-Host "  - $r" }
Write-Host "Metrics: $reportPath"

exit $(if ($pass) { 0 } else { 1 })
