param(
  [string]$Serial = ""
)

$ErrorActionPreference = "Stop"

function Step($msg) {
  Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

function Fail($msg) {
  Write-Host "`n[ERRO] $msg" -ForegroundColor Red
  exit 1
}

$AdbExe = $null

function Invoke-Adb {
  param(
    [string[]]$Args
  )
  return & $AdbExe @Args 2>&1
}

function Restart-AdbDaemon {
  Invoke-Adb -Args @('kill-server') | Out-Null
  Start-Process -FilePath taskkill -ArgumentList '/F','/IM','adb.exe' -NoNewWindow -Wait -ErrorAction SilentlyContinue | Out-Null
  Invoke-Adb -Args @('start-server') | Out-Null
}

function Invoke-AdbWithRetry {
  param(
    [string[]]$Args,
    [int]$Attempts = 4
  )

  for ($i = 1; $i -le $Attempts; $i += 1) {
    $output = Invoke-Adb -Args $Args
    $ok = ($LASTEXITCODE -eq 0)
    if ($ok) {
      return [PSCustomObject]@{
        Ok = $true
        Output = $output
      }
    }

    $flat = ($output | Out-String)
    if ($flat -match 'closed|device offline|device not found|more than one device') {
      continue
    }

    return [PSCustomObject]@{
      Ok = $false
      Output = $output
    }
  }

  return [PSCustomObject]@{
    Ok = $false
    Output = @('adb retry limit reached')
  }
}

Step "Garantindo SDK Android no PATH da sessao"
$Sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (-not (Test-Path $Sdk)) {
  Fail "Android SDK nao encontrado em $Sdk"
}
$env:ANDROID_SDK_ROOT = $Sdk
$env:ANDROID_HOME = $Sdk
$platformTools = Join-Path $Sdk "platform-tools"
$env:Path = "$platformTools;$env:Path"
$AdbExe = Join-Path $platformTools "adb.exe"
if (-not (Test-Path $AdbExe)) {
  Fail "adb.exe nao encontrado em $AdbExe"
}

if ([string]::IsNullOrWhiteSpace($Serial)) {
  Step "Reset completo do ADB"
  Restart-AdbDaemon
  Invoke-Adb -Args @('disconnect') | Out-Null
  Start-Sleep -Milliseconds 500
} else {
  Step "Inicializando ADB sem reset agressivo (serial explicito)"
  Invoke-Adb -Args @('start-server') | Out-Null
}

Step "Leitura de dispositivos"
$adbRaw = Invoke-Adb -Args @('devices')
$deviceLines = @()
$unauthorizedLines = @()

foreach ($line in $adbRaw) {
  $s = [string]$line
  if ($s -match '^\s*(\S+)\s+device\s*$') { $deviceLines += $Matches[1] }
  if ($s -match '^\s*(\S+)\s+unauthorized\s*$') { $unauthorizedLines += $Matches[1] }
}

if ($unauthorizedLines.Count -gt 0) {
  Write-Host "Dispositivo(s) unauthorized detectado(s):" -ForegroundColor Yellow
  $unauthorizedLines | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
  if ([string]::IsNullOrWhiteSpace($Serial)) {
    Fail "Revogue autorizacoes USB no telefone, reconecte apenas 1 aparelho e aceite a chave RSA."
  }
  Write-Host "Continuando com serial explicito: $Serial" -ForegroundColor Yellow
}

if ([string]::IsNullOrWhiteSpace($Serial)) {
  if ($deviceLines.Count -ne 1) {
    Write-Host "Saida atual do adb devices:" -ForegroundColor Yellow
    $adbRaw | ForEach-Object { Write-Host $_ }
    Fail "E necessario exatamente 1 dispositivo com estado 'device'."
  }
  $Serial = $deviceLines[0]
}

$targetPresent = $false
$detectedSerials = @()
foreach ($line in $deviceLines) {
  $current = [string]$line
  $detectedSerials += $current
  if ($current -eq $Serial) {
    $targetPresent = $true
    break
  }
}
Write-Host "Serial alvo: $Serial | Detectados: $($detectedSerials -join ', ')" -ForegroundColor DarkGray
if (-not $targetPresent) {
  for ($retry = 1; $retry -le 8; $retry += 1) {
    Start-Sleep -Seconds 2
    $adbRaw = Invoke-Adb -Args @('devices')
    $deviceLines = @()
    foreach ($line in $adbRaw) {
      $s = [string]$line
      if ($s -match '^\s*(\S+)\s+device\s*$') { $deviceLines += $Matches[1] }
    }

    foreach ($line in $deviceLines) {
      $current = [string]$line
      if ($current -eq $Serial) {
        $targetPresent = $true
        break
      }
    }

    if ($targetPresent) {
      break
    }
  }
}
if (-not $targetPresent) {
  if ([string]::IsNullOrWhiteSpace($Serial)) {
    Fail "Serial alvo $Serial nao esta em estado 'device'."
  }
  Write-Host "Serial nao apareceu em 'adb devices' nesta janela; validando diretamente via getprop com retry." -ForegroundColor Yellow
}

Step "Validando transporte ADB do serial $Serial"
$propResult = Invoke-AdbWithRetry -Args @('-s', $Serial, 'shell', 'getprop', 'ro.build.version.sdk') -Attempts 5
if (-not $propResult.Ok) {
  Fail "Falha em getprop no serial $Serial (transporte ADB instavel). Troque cabo/porta e driver USB."
}
$api = ($propResult.Output | Out-String).Trim()
Write-Host "API level: $api" -ForegroundColor Green

Step "Configurando reverse do Metro e APIs locais"
Invoke-AdbWithRetry -Args @('-s', $Serial, 'reverse', '--remove-all') | Out-Null
Invoke-AdbWithRetry -Args @('-s', $Serial, 'reverse', 'tcp:8081', 'tcp:8081') | Out-Null
Invoke-AdbWithRetry -Args @('-s', $Serial, 'reverse', 'tcp:8082', 'tcp:8082') | Out-Null
Invoke-AdbWithRetry -Args @('-s', $Serial, 'reverse', 'tcp:3000', 'tcp:3000') | Out-Null

Step "Validando Metro local"
try {
  $metro = Invoke-WebRequest "http://127.0.0.1:8081/status" -UseBasicParsing -TimeoutSec 5
  if ($metro.Content -notmatch "packager-status:running") {
    Fail "Metro nao esta em estado running na porta 8081."
  }
} catch {
  Fail "Metro indisponivel em http://127.0.0.1:8081/status"
}

Step "Build e install manual no device alvo"
$repoRoot = Join-Path $PSScriptRoot ".."
Set-Location (Join-Path $repoRoot "android")
& .\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) {
  Fail "assembleDebug falhou"
}

$apkPath = Join-Path $repoRoot "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkPath)) {
  Fail "APK debug nao encontrado em $apkPath"
}

$installResult = Invoke-AdbWithRetry -Args @('-s', $Serial, 'install', '-r', '-d', '-g', $apkPath) -Attempts 5
if (-not $installResult.Ok) {
  Fail "adb install falhou para o serial $Serial"
}

$launchResult = Invoke-AdbWithRetry -Args @('-s', $Serial, 'shell', 'monkey', '-p', 'com.tipolt.evolucaofullv2', '-c', 'android.intent.category.LAUNCHER', '1')
if (-not $launchResult.Ok) {
  Fail "Falha ao iniciar app apos install no serial $Serial"
}

Write-Host "`n[OK] App instalado e aberto no dispositivo $Serial" -ForegroundColor Green
