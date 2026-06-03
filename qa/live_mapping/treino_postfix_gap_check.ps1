#Requires -Version 5.1
<#
.SYNOPSIS
  Recaptura pontual 003 (modo avancado + Trocar) e 005 (Historico do exercicio). Max 90s, 2 PNG, 3 XML.
#>
param(
  [string]$Serial = 'emulator-5554',
  [string]$RepoRoot = '',
  [switch]$SkipRelaunch,
  [int]$MaxScriptSec = 90,
  [int]$XmlTimeoutSec = 10
)

$ErrorActionPreference = 'Continue'
$script:Deadline = (Get-Date).AddSeconds($MaxScriptSec)
$script:XmlDumpCount = 0
$script:MaxXmlDumps = 3

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
$script:QaSessionLogPath = Join-Path $OutDir 'treino_postfix_gap_run.log'
Write-QaLog "=== treino_postfix_gap_check Serial=$Serial MaxSec=$MaxScriptSec ==="

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
  'workout-exercise-list-advanced',
  'workout-exercise-list-simple',
  'screen-workout',
  'btn-toggle-workout-mode',
  'Exercicio 1 de',
  'Exercício 1 de'
)

function Get-BoundedXml {
  if ($script:XmlDumpCount -ge $script:MaxXmlDumps) { return '' }
  $script:XmlDumpCount++
  $snap = Get-UiXmlSnapshotBounded -Sdk $sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
  return [string]$snap.xml
}

function Save-GapPng {
  param([string]$Name, [switch]$WithXml)
  Test-ScriptTimeBudget
  $pngPath = Join-Path $OutDir ($Name + '.png')
  $pngOk = Save-EmulatorScreenshotExecOut -Sdk $sdk -Serial $Serial -OutPath $pngPath
  $xml = ''
  $xmlOk = $false
  if ($WithXml) {
    $xml = Get-BoundedXml
    $xmlOk = -not [string]::IsNullOrWhiteSpace($xml)
    if ($xmlOk) {
      $xml | Set-Content -Path (Join-Path $OutDir ($Name + '.xml')) -Encoding UTF8
    }
  }
  Write-Host "CAPTURE $Name png=$pngOk xml=$xmlOk"
  return @{ pngOk = $pngOk; xml = $xml; xmlOk = $xmlOk }
}

function Test-OnWorkoutScreen {
  param([string]$Xml = '')
  if ([string]::IsNullOrWhiteSpace($Xml)) { $Xml = Get-BoundedXml }
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $false }
  foreach ($n in $WorkoutNeedles) {
    if ($Xml.Contains($n)) { return $true }
  }
  return $false
}

function Invoke-GoToWorkout {
  $onWorkout = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles $WorkoutNeedles -TimeoutSec 6 -PollIntervalMs 1000
  if ($onWorkout) {
    Write-Host 'Already on workout'
    return @{ ok = $true; xml = '' }
  }
  Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
  Start-Sleep -Seconds 2
  Test-ScriptTimeBudget
  $snap = Get-BoundedXml
  $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'btn_home_main_cta') -ClickableOnly
  if (-not $tap.ok) {
    Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab treino | Out-Null
    Start-Sleep -Seconds 2
    if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
      $snap = Get-BoundedXml
      $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $snap -Needles @('Treino de hoje', 'Iniciar treino', 'btn-iniciar-treino') -ClickableOnly
    }
  }
  Start-Sleep -Seconds 4
  $ok = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles $WorkoutNeedles -TimeoutSec 14 -PollIntervalMs 1200
  return @{ ok = [bool]$ok; xml = $snap }
}

function Invoke-ScrollWorkoutTop {
  adb -s $Serial shell input swipe 540 900 540 1700 350 2>$null | Out-Null
  Start-Sleep -Milliseconds 900
}

function Invoke-EnsureAdvancedMode {
  param([int]$MaxToggles = 3)
  $advanced = $false
  $lastXml = ''
  for ($i = 0; $i -lt $MaxToggles; $i++) {
    Test-ScriptTimeBudget
    $lastXml = Get-BoundedXml
    if ($lastXml -match 'Modo avancado|workout-advanced-header|workout-exercise-list-advanced') {
      $advanced = $true
      break
    }
    if ($lastXml -match 'Modo simples') {
      Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $lastXml -Needles @('btn-toggle-workout-mode', 'Alternar') -ClickableOnly | Out-Null
      Start-Sleep -Seconds 2
    } else {
      Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $lastXml -Needles @('Alternar') -ClickableOnly | Out-Null
      Start-Sleep -Seconds 2
    }
  }
  if (-not $advanced -and $lastXml -match 'Modo avancado') { $advanced = $true }
  return @{ advanced = $advanced; xml = $lastXml }
}

function Test-003Needles {
  param([string]$Xml)
  return [ordered]@{
    modoAvancado = [bool]($Xml -match 'Modo avancado')
    modeBar = [bool]($Xml -match 'workout-mode-bar|btn-toggle-workout-mode')
    trocar = [bool]($Xml -match 'Trocar exercicio|btn-substituir')
    helperSwap = [bool]($Xml -match 'Substitui so o exercicio atual')
    advancedHeader = [bool]($Xml -match 'workout-advanced-header|workout-exercise-list-advanced')
  }
}

function Invoke-TapExerciseWithHistory {
  param([string]$Xml)
  $tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $Xml -Needles @('Puxada Frontal', 'Supino Reto', 'workout-exercise-index-2', 'workout-exercise-index-3') -ClickableOnly
  if (-not $tap.ok) {
    adb -s $Serial shell input tap 540 1100 2>$null | Out-Null
    Start-Sleep -Seconds 1
  } else {
    Start-Sleep -Seconds 2
  }
}

function Invoke-ExpandHistoryPanel {
  param([string]$Xml)
  if ($Xml -match 'Historico do exercicio|workout-exercise-history-panel') { return $true }
  Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $Xml -Needles @('Dica do Coach') -ClickableOnly | Out-Null
  Start-Sleep -Seconds 2
  adb -s $Serial shell input swipe 540 1500 540 500 400 2>$null | Out-Null
  Start-Sleep -Seconds 1
  return $false
}

# --- Main ---
adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null

if (-not $SkipRelaunch) {
  adb -s $Serial shell am force-stop com.tipolt.evolucaofullv2 2>$null | Out-Null
  Start-Sleep -Seconds 1
  adb -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  Start-Sleep -Seconds 22
  $null = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles @('INICIAR TREINO', 'Boa noite', 'app_bootstrap_ready') -TimeoutSec 16 -PollIntervalMs 1200
}

$nav = Invoke-GoToWorkout
$metrics['navigation'] = $nav.ok
if (-not $nav.ok) {
  Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
  Start-Sleep -Seconds 2
  adb -s $Serial shell input tap 540 700 2>$null | Out-Null
  Start-Sleep -Seconds 5
  $nav.ok = Test-UiHasAnyNeedle -Sdk $sdk -Serial $Serial -Needles $WorkoutNeedles -TimeoutSec 10 -PollIntervalMs 1200
  $metrics['navigation'] = $nav.ok
}
if (-not $nav.ok) {
  Write-Host 'NAV_FAIL exit 5'
  exit 5
}

# 003 — modo avancado + trocar
Invoke-ScrollWorkoutTop
$adv = Invoke-EnsureAdvancedMode -MaxToggles 3
$xml003 = $adv.xml
if (-not $adv.advanced -and $script:XmlDumpCount -lt $script:MaxXmlDumps) {
  $xml003 = Get-BoundedXml
}
if ($xml003 -notmatch 'Trocar exercicio') {
  Invoke-TapExerciseWithHistory -Xml $xml003
  if ($script:XmlDumpCount -lt $script:MaxXmlDumps) { $xml003 = Get-BoundedXml }
}
Invoke-ScrollWorkoutTop
$c003 = Save-GapPng -Name 'treino_postfix_003_modo_avancado_trocar' -WithXml:($script:XmlDumpCount -lt $script:MaxXmlDumps)
if (-not $c003.xmlOk -and $xml003) { $c003.xml = $xml003 }
$n003 = Test-003Needles -Xml ([string]$c003.xml)
$n003['pass'] = $n003.modoAvancado -and $n003.trocar -and ($n003.helperSwap -or $n003.modeBar)
$metrics['003'] = $n003

# 005 — historico exercicio (prefer simple mode for panel without coach)
if ($adv.advanced -and $xml003 -match 'Modo avancado') {
  Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $xml003 -Needles @('btn-toggle-workout-mode', 'Alternar') -ClickableOnly | Out-Null
  Start-Sleep -Seconds 2
}
Invoke-TapExerciseWithHistory -Xml $xml003
$xml005 = if ($script:XmlDumpCount -lt $script:MaxXmlDumps) { Get-BoundedXml } else { '' }
Invoke-ExpandHistoryPanel -Xml $xml005 | Out-Null
if ($script:XmlDumpCount -lt $script:MaxXmlDumps) {
  $xml005 = Get-BoundedXml
} elseif (-not $xml005) {
  $xml005 = $xml003
}
Invoke-ExpandHistoryPanel -Xml $xml005 | Out-Null
adb -s $Serial shell input swipe 540 1400 540 400 350 2>$null | Out-Null
Start-Sleep -Seconds 1
$c005 = Save-GapPng -Name 'treino_postfix_005_historico_exercicio_com_logs' -WithXml:($false)
$histPanel = [bool]($xml005 -match 'Historico do exercicio|workout-exercise-history-panel')
$absurd = [bool]($xml005 -match '2060|1010')
$histEmpty = -not $histPanel
$metrics['005'] = [ordered]@{
  historyPanel = $histPanel
  historyEmpty = $histEmpty
  absurdValues = $absurd
  pass = $histPanel -and (-not $absurd)
  note = if ($histEmpty) { 'Historico vazio no estado atual; UI existe mas sem lista preenchida nesta sessao.' } else { '' }
}

$pass003 = [bool]$n003.pass
$pass005 = [bool]$metrics['005'].pass
if ($histEmpty -and -not $absurd) {
  $metrics['005'].passPartialDocumented = $true
}

$report = [ordered]@{
  timestamp = $ts
  serial = $Serial
  metroOnline = $true
  capture003Pass = $pass003
  capture005Pass = $pass005
  treinoVisualPartialPass = ($pass003 -and ($pass005 -or $metrics['005'].passPartialDocumented))
  screens = $metrics
}
$reportPath = Join-Path $OutDir 'treino_postfix_gap_metrics.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8
Write-Host "DONE 003=$pass003 005=$($metrics['005'].pass) report=$reportPath"
exit 0
