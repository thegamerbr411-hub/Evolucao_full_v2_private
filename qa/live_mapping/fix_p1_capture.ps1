#Requires -Version 5.1
param(
  [string]$Serial = 'emulator-5554',
  [string]$RepoRoot = ''
)

if ($Serial -notmatch '^emulator-') { throw "EMULATOR-ONLY: $Serial" }
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

$env:EVOLUCAO_QA_TARGET = 'emulator'
$env:ADB_DEVICE = $Serial
. (Join-Path $RepoRoot 'tools\lib\AndroidQaTarget.ps1')

$OutDir = Join-Path $PSScriptRoot 'screenshots\fix_p1'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$sdk = Resolve-AndroidSdk

function Save-FixShot {
  param([string]$Name)
  $path = Join-Path $OutDir ($Name + '.png')
  cmd.exe /c "adb -s $Serial exec-out screencap -p > `"$path`" 2>nul"
  if (-not (Test-Path $path) -or (Get-Item $path).Length -lt 500) {
    throw "Falha screencap: $Name"
  }
  Write-Host "OK $Name"
}

Invoke-EnsureEvolucaoForeground -Sdk $sdk -Serial $Serial | Out-Null
Start-Sleep -Seconds 2

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
Start-Sleep -Seconds 2
Save-FixShot 'fix_001_home'

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab treino | Out-Null
Start-Sleep -Seconds 2
Save-FixShot 'fix_002_treino_tab'

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab coach | Out-Null
Start-Sleep -Seconds 2
Save-FixShot 'fix_003_coach'

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab nutricao | Out-Null
Start-Sleep -Seconds 2
Save-FixShot 'fix_004_nutricao'

Invoke-TapTab -Sdk $sdk -Serial $Serial -Tab home | Out-Null
Start-Sleep -Seconds 2
$homeXml = Get-UiXmlSnapshot -Sdk $sdk -Serial $Serial
$tap = Invoke-TapUiNeedle -Sdk $sdk -Serial $Serial -Xml $homeXml -Needles @('CONTINUAR TREINO', 'INICIAR TREINO', 'btn_home_main_cta') -ClickableOnly
if ($tap.ok) {
  Start-Sleep -Seconds 3
}
Save-FixShot 'fix_005_continuar_treino'

Write-Host "Capturas em $OutDir"
