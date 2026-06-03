#Requires -Version 5.1
<#
.SYNOPSIS
  Validacao P1 pos-reload: relaunch, captura PNG+XML, metricas, deteccao bundle antigo.
.PARAMETER Phase
  quick = relaunch rapido (Fase 1)
  metro_clean = apos Metro -c (Fase 2) — so captura, assume Metro ja subiu
#>
param(
  [ValidateSet('quick', 'metro_clean')]
  [string]$Phase = 'quick',
  [string]$Serial = 'emulator-5554',
  [string]$RepoRoot = ''
)

$ErrorActionPreference = 'Continue'
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
  param([int]$Port = 8081)
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/status" -UseBasicParsing -TimeoutSec 4
    $body = $resp.Content
    if ($body -is [byte[]]) {
      $body = [System.Text.Encoding]::UTF8.GetString($body)
    }
    return [bool]($body -match 'packager-status:running|running')
  } catch {
    return $false
  }
}

if (-not (Test-MetroOnline)) {
  $offlinePath = Join-Path $PSScriptRoot 'metro_debug\metro_offline.json'
  New-Item -ItemType Directory -Force -Path (Split-Path $offlinePath) | Out-Null
  @{
    timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
    port = 8081
    phase = $Phase
    serial = $Serial
    message = 'Metro offline - run start_metro_logged.ps1 + wait_metro_ready.ps1 before validation'
  } | ConvertTo-Json | Set-Content -Path $offlinePath -Encoding UTF8
  Write-Host "METRO_OFFLINE - aborting validation (exit 3). See $offlinePath"
  Write-Host "Run: qa\live_mapping\metro_debug\start_metro_logged.ps1 then wait_metro_ready.ps1"
  exit 3
}

$sdk = Resolve-AndroidSdk
$metrics = [ordered]@{}
$ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'

function Get-ProteinText {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $null }
  if ($Xml -match '([0-9]+)\s*/\s*([0-9]+)\s*g') { return "$($Matches[1])/$($Matches[2])g" }
  if ($Xml -match '([0-9]+)g\s*/\s*([0-9]+)g') { return "$($Matches[1])/$($Matches[2])g" }
  return $null
}

function Get-StreakText {
  param([string]$Xml)
  if ($Xml -match 'Sem sequencia ativa') { return 'Sem sequencia ativa' }
  if ($Xml -match 'Dia\s+(\d+)\s+de\s+sequ') { return "Dia $($Matches[1]) de sequencia" }
  if ($Xml -match '(\d+)\s+dias?\s+de\s+sequencia') { return "$($Matches[1]) dias de sequencia" }
  if ($Xml -match '(\d+)\s+dias?\s+seguidos') { return "$($Matches[1]) dias seguidos" }
  return $null
}

function Get-XpTodayText {
  param([string]$Xml)
  if ($Xml -match '\+(\d+)\s+XP\s+hoje') { return [int]$Matches[1] }
  return $null
}

function Get-HomeCtaText {
  param([string]$Xml)
  if ($Xml -match 'CONTINUAR TREINO') { return 'CONTINUAR TREINO' }
  if ($Xml -match 'INICIAR TREINO') { return 'INICIAR TREINO' }
  return $null
}

function Get-TreinoHubStatus {
  param([string]$Xml)
  if ($Xml -match 'text="Em andamento"') { return 'Em andamento' }
  if ($Xml -match 'text="Nao iniciado"') { return 'Nao iniciado' }
  if ($Xml -match 'text="Concluido"') { return 'Concluido' }
  if ($Xml -match 'text="Não iniciado"') { return 'Nao iniciado' }
  return $null
}

function Get-HubCtaText {
  param([string]$Xml)
  if ($Xml -match 'text="Continuar treino"') { return 'Continuar treino' }
  if ($Xml -match 'text="Iniciar treino"') { return 'Iniciar treino' }
  return $null
}

function Get-ExerciseProgressText {
  param([string]$Xml)
  if ($Xml -match 'Exercicio\s+(\d+)\s+de\s+(\d+)') { return "Exercicio $($Matches[1]) de $($Matches[2])" }
  if ($Xml -match 'Exercício\s+(\d+)\s+de\s+(\d+)') { return "Exercicio $($Matches[1]) de $($Matches[2])" }
  return $null
}

function Save-FixCapture {
  param(
    [string]$Name,
    [string]$ScreenLabel
  )
  $pngPath = Join-Path $OutDir ($Name + '.png')
  $xmlPath = Join-Path $OutDir ($Name + '.xml')
  cmd.exe /c "adb -s $Serial exec-out screencap -p > `"$pngPath`" 2>nul"
  if (-not (Test-Path $pngPath) -or (Get-Item $pngPath).Length -lt 500) {
    throw "Falha screencap: $Name"
  }
  $xml = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
  Set-Content -Path $xmlPath -Value $xml -Encoding UTF8

  $wm = $null
  if ($ScreenLabel -eq 'workout' -or $xml -match 'workout-exercise-progress|Treino de hoje') {
    $wm = Get-WorkoutUiMetrics -Xml $xml -ExpectedExerciseTotal 5
  }

  $entry = [ordered]@{
    screen = $ScreenLabel
    png = "screenshots/fix_p1/$Name.png"
    xml = "screenshots/fix_p1/$Name.xml"
    protein = Get-ProteinText -Xml $xml
    streak = Get-StreakText -Xml $xml
    xpToday = Get-XpTodayText -Xml $xml
    homeCta = if ($ScreenLabel -eq 'home') { Get-HomeCtaText -Xml $xml } else { $null }
    treinoStatus = if ($ScreenLabel -eq 'treino_hub') { Get-TreinoHubStatus -Xml $xml } else { $null }
    hubCta = if ($ScreenLabel -eq 'treino_hub') { Get-HubCtaText -Xml $xml } else { $null }
    exerciseProgress = Get-ExerciseProgressText -Xml $xml
    coachTreinoLine = if ($xml -match 'Treino:\s*[^|]+') { $Matches[0] } else { $null }
    coachTreinoProgress = [bool]($xml -match 'em andamento')
    coachNaoTreinou = [bool]($xml -match 'nao treinou|não treinou|Comeca agora')
    registrar10kg = [bool]($xml -match 'Registrar\s+\d+kg|Registrar 10kg')
    fecheEm1Toque = [bool]($xml -match 'Feche em 1 toque')
    finishVisible = [bool]($xml -match 'Finalizar treino|btn-finalizar-treino')
    continueButtonVisible = [bool]($xml -match 'Continuar treino|btn-continuar-treino')
    partialExitVisible = [bool]($xml -match 'Sair e salvar progresso|Salvar parcial e sair|btn-salvar-parcial')
    finishVisibleEarly = $false
    proteinGoal160 = [bool]($xml -match '/160\s*g|/160g|160g')
    proteinGoal150 = [bool]($xml -match '/150\s*g|/150g|150g')
    workoutMetrics = $wm
  }
  if ($wm -and $entry.finishVisible -and $wm.seriesTotal -gt 0 -and $wm.seriesDone -lt $wm.seriesTotal) {
    $entry.finishVisibleEarly = $true
  }
  if ($entry.fecheEm1Toque) {
    $entry.finishVisibleEarly = $true
  }
  $script:metrics[$Name] = $entry
  Write-Host "OK $Name ($ScreenLabel)"
  return $entry
}

function Invoke-QuickRelaunch {
  adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
  adb -s $Serial shell am force-stop com.tipolt.evolucaofullv2 2>$null | Out-Null
  Start-Sleep -Seconds 1
  adb -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  Start-Sleep -Seconds 24
  adb -s $Serial shell input keyevent KEYCODE_ESCAPE 2>$null | Out-Null
  Start-Sleep -Seconds 2
  Invoke-EnsureEvolucaoForeground -Sdk $sdk -Serial $Serial | Out-Null
  Start-Sleep -Seconds 2
}

function Test-StaleBundleSignals {
  $signals = [System.Collections.Generic.List[string]]::new()
  foreach ($key in $metrics.Keys) {
    $m = $metrics[$key]
    if ($m.proteinGoal150 -and -not $m.proteinGoal160) {
      $signals.Add("${key}: proteina meta 150g")
    }
    if ($key -eq 'fix_001_home' -and $m.xpToday -eq 120) {
      $signals.Add("${key}: +120 XP hoje (hardcoded antigo)")
    }
    if ($key -eq 'fix_001_home' -and $m.streak -match 'Dia 1' -and $metrics.fix_003_coach.streak -match '0|Sem') {
      $signals.Add("${key}: streak Dia 1 forcado vs Coach")
    }
    if ($key -eq 'fix_005_continuar_treino' -and $m.exerciseProgress -match '1 de 1') {
      $signals.Add("${key}: Exercicio 1 de 1")
    }
    if ($m.registrar10kg) {
      $signals.Add("${key}: Registrar Nkg visivel")
    }
    if ($m.fecheEm1Toque) {
      $signals.Add("${key}: Feche em 1 toque visivel")
    }
    if ($m.finishVisibleEarly -or ($m.finishVisible -and $m.workoutMetrics -and $m.workoutMetrics.seriesDone -lt $m.workoutMetrics.seriesTotal)) {
      $signals.Add("${key}: Finalizar treino cedo demais ($($m.workoutMetrics.seriesDone)/$($m.workoutMetrics.seriesTotal))")
    }
  }
  return @{
    stale = ($signals.Count -gt 0)
    signals = @($signals)
  }
}

Write-Host "=== fix_p1_validate Phase=$Phase Serial=$Serial ==="

if ($Phase -eq 'quick') {
  Invoke-QuickRelaunch
} else {
  Invoke-QuickRelaunch
}

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
Start-Sleep -Seconds 2
Save-FixCapture -Name 'fix_001_home' -ScreenLabel 'home' | Out-Null

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab treino | Out-Null
Start-Sleep -Seconds 2
Save-FixCapture -Name 'fix_002_treino_tab' -ScreenLabel 'treino_hub' | Out-Null

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab coach | Out-Null
Start-Sleep -Seconds 2
Save-FixCapture -Name 'fix_003_coach' -ScreenLabel 'coach' | Out-Null

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab nutricao | Out-Null
Start-Sleep -Seconds 2
Save-FixCapture -Name 'fix_004_nutricao' -ScreenLabel 'nutricao' | Out-Null

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
Start-Sleep -Seconds 2
$homeXml = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
$tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $homeXml -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'btn_home_main_cta') -ClickableOnly
if ($tap.ok) { Start-Sleep -Seconds 3 }
Save-FixCapture -Name 'fix_005_continuar_treino' -ScreenLabel 'workout' | Out-Null

$bundleCheck = Test-StaleBundleSignals
$report = [ordered]@{
  timestamp = $ts
  phase = $Phase
  serial = $Serial
  bundleStale = $bundleCheck.stale
  staleSignals = $bundleCheck.signals
  screens = $metrics
}

$metricsPath = Join-Path $OutDir 'fix_p1_metrics.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $metricsPath -Encoding UTF8

Write-Host ""
Write-Host "=== BUNDLE CHECK ==="
Write-Host "Stale: $($bundleCheck.stale)"
foreach ($s in $bundleCheck.signals) { Write-Host "  - $s" }
Write-Host "Metrics: $metricsPath"

if ($bundleCheck.stale -and $Phase -eq 'quick') {
  Write-Host ""
  Write-Host "STALE_BUNDLE_DETECTED - execute Fase 2: npx expo start -c, depois fix_p1_validate.ps1 -Phase metro_clean"
  exit 2
}

exit 0
