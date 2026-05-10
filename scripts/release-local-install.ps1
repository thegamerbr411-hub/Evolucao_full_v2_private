param(
  [string]$Serial = "",
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'

function Step([string]$msg) {
  Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

function Fail([string]$msg) {
  Write-Host "`n[ERRO] $msg" -ForegroundColor Red
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'
$apkSource = Join-Path $repoRoot 'android\app\build\outputs\apk\release\app-release.apk'
$apkOutDir = Join-Path $repoRoot 'build-output'
$apkOutPath = Join-Path $apkOutDir 'app-release.apk'

Step 'Gerando APK release local (Gradle assembleRelease)'
Set-Location $androidDir
& .\gradlew.bat assembleRelease
if ($LASTEXITCODE -ne 0) {
  Fail 'assembleRelease falhou'
}

if (-not (Test-Path $apkSource)) {
  Fail "APK release nao encontrado em: $apkSource"
}

if (-not (Test-Path $apkOutDir)) {
  New-Item -ItemType Directory -Path $apkOutDir -Force | Out-Null
}

Copy-Item -Path $apkSource -Destination $apkOutPath -Force

Step 'APK pronto em caminho fixo'
Write-Host "APK: $apkOutPath" -ForegroundColor Green

if ($NoInstall) {
  Step 'Modo NoInstall: finalizado'
  exit 0
}

Step 'Preparando ADB'
$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$adbPath = Join-Path $sdkRoot 'platform-tools\adb.exe'
if (-not (Test-Path $adbPath)) {
  Fail "adb.exe nao encontrado em: $adbPath"
}
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot
if (($env:Path -split ';') -notcontains (Join-Path $sdkRoot 'platform-tools')) {
  $env:Path = "$(Join-Path $sdkRoot 'platform-tools');$env:Path"
}

Step 'Detectando dispositivo'
$devicesRaw = & $adbPath devices
$devices = @()
foreach ($line in $devicesRaw) {
  $txt = [string]$line
  if ($txt -match '^\s*(\S+)\s+device\s*$') {
    $devices += $Matches[1]
  }
}

if ([string]::IsNullOrWhiteSpace($Serial)) {
  $physical = $devices | Where-Object { -not ([string]$_).StartsWith('emulator-') } | Select-Object -First 1
  if ($physical) {
    $Serial = [string]$physical
  } elseif ($devices.Count -gt 0) {
    $Serial = [string]$devices[0]
  }
}

if ([string]::IsNullOrWhiteSpace($Serial)) {
  Fail 'Nenhum device/emulador em estado device no adb.'
}

Step "Instalando APK no serial $Serial"
& $adbPath -s $Serial install -r -d -g $apkOutPath | Out-Null
if ($LASTEXITCODE -ne 0) {
  Fail 'adb install falhou'
}

Step 'Abrindo app'
& $adbPath -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host "`n[OK] Build e instalacao concluidas." -ForegroundColor Green
Write-Host "Use sempre: npm run release:install" -ForegroundColor Green
Write-Host "APK fixo: $apkOutPath" -ForegroundColor Green
