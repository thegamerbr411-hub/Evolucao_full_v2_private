$ErrorActionPreference = 'Stop'

$adbFromEnv = Get-Command adb -ErrorAction SilentlyContinue
if ($adbFromEnv) {
  Write-Host "adb ja disponivel em: $($adbFromEnv.Source)"
  exit 0
}

$sdkAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools'
$adbExe = Join-Path $sdkAdb 'adb.exe'

if (-not (Test-Path $adbExe)) {
  Write-Error 'adb.exe nao encontrado. Instale Android SDK Platform Tools.'
  exit 1
}

if (($env:Path -split ';') -notcontains $sdkAdb) {
  $env:Path = "$sdkAdb;$env:Path"
  Write-Host "PATH atualizado para sessao atual com: $sdkAdb"
}

$adbCheck = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbCheck) {
  Write-Error 'Falha ao registrar adb no PATH da sessao.'
  exit 1
}

Write-Host "adb pronto: $($adbCheck.Source)"
