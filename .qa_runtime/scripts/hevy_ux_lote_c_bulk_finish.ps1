#Requires -Version 5.1
param(
  [string]$Serial = 'emulator-5554',
  [int]$MaxSets = 15,
  [int]$MaxSec = 900
)

if ($Serial -notmatch '^emulator-') { throw "EMULATOR-ONLY: $Serial" }
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $RepoRoot 'tools\lib\AndroidQaTarget.ps1')

$sdk = Resolve-AndroidSdk
$deadline = (Get-Date).AddSeconds($MaxSec)

function Test-Budget { if ((Get-Date) -gt $deadline) { throw "TIME_BUDGET_EXCEEDED" } }

function Dismiss-DevMenu {
  $xml = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
  if ($xml -match 'React Native Dev Menu|Connect to the bundler') {
    Invoke-AdbBack -Sdk $sdk -Serial $Serial -Times 2 | Out-Null
    Start-Sleep -Seconds 1
    return $true
  }
  return $false
}

function Ensure-SimpleWorkoutView {
  for ($i = 0; $i -lt 8; $i++) {
    Test-Budget
    Dismiss-DevMenu | Out-Null
    $xml = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
    if ($xml -match 'workout-exercise-list-simple|input-weight') { return $true }
    if ($xml -match 'workout-exercise-list-advanced|Vis.o completa|Visão completa') {
      for ($s = 0; $s -lt 4; $s++) {
        adb -s $Serial shell input swipe 540 500 540 1700 350 2>$null | Out-Null
        Start-Sleep -Milliseconds 400
      }
      Invoke-ToggleWorkoutMode -Sdk $sdk -Serial $Serial | Out-Null
      Start-Sleep -Seconds 1
      continue
    }
    break
  }
  $final = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
  return [bool]($final -match 'workout-exercise-list-simple|input-weight')
}

Write-Host "BULK_FINISH start serial=$Serial"
adb -s $Serial reverse tcp:8081 tcp:8081 2>$null | Out-Null
Dismiss-DevMenu | Out-Null

$opened = Invoke-OpenWorkoutScreen -Sdk $sdk -Serial $Serial
if (-not $opened.ok) { throw "WORKOUT_OPEN_FAILED path=$($opened.path)" }
Write-Host "WORKOUT_OPEN path=$($opened.path)"

Ensure-SimpleWorkoutView | Out-Null
$saved = 0
for ($round = 0; $round -lt $MaxSets; $round++) {
  Test-Budget
  Dismiss-DevMenu | Out-Null
  $xml = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
  if ($xml -match 'Finalizar treino|btn-finalizar-treino') {
    Write-Host "FINISH_VISIBLE rounds=$round saved=$saved"
    break
  }
  if ($xml -notmatch 'input-weight|btn-save-set') {
    Ensure-SimpleWorkoutView | Out-Null
    adb -s $Serial shell input swipe 540 1700 540 500 350 2>$null | Out-Null
    Start-Sleep -Milliseconds 700
  }
  Invoke-SaveOneWorkoutSet -Sdk $sdk -Serial $Serial -Weight '10' -Reps '10'
  $saved++
  Write-Host "SAVE_ROUND $saved"
  $xml2 = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
  Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $xml2 -Needles @('btn-rest-timer-skip', 'Pular') -ClickableOnly | Out-Null
  Start-Sleep -Milliseconds 800
}

$xmlF = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
$tapFinish = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $xmlF -Needles @('btn-finalizar-treino', 'Finalizar treino') -ClickableOnly
Start-Sleep -Seconds 3
$xmlS = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
$summary = [bool]($xmlS -match 'screen-workout-complete|Treino conclu|Resumo do treino')
Write-Host "FINISH_TAP ok=$($tapFinish.ok) summary=$summary saved=$saved"
if (-not $summary) { exit 2 }
exit 0
