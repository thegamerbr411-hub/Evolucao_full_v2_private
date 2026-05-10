param(
  [string]$Device = "RQ8T209ZTAF",
  [string]$Email = "thegamerbr411@gmail.com",
  [string]$Password = "fe123456",
  [string]$OutRoot = ""
)

$ErrorActionPreference = "Stop"

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  throw "adb nao encontrado em $adb"
}

$projectRoot = "F:\projetos\evolucao app"
if ([string]::IsNullOrWhiteSpace($OutRoot)) {
  $OutRoot = Join-Path $projectRoot "stabilization_phase_2\VIDEO_VALIDATION"
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$runDir = Join-Path $OutRoot "run_$ts"
$shotsDir = Join-Path $runDir "screenshots"
$logsDir = Join-Path $runDir "logs"

New-Item -ItemType Directory -Force -Path $shotsDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$script:step = 0
$script:videoFound = $false
$script:externalOpenTriggered = $false
$script:internalPlayerTriggered = $false
$script:fullscreenTriggered = $false
$script:logoutTriggered = $false
$script:authScreenAfterRelaunch = $false

function ADB([string[]]$args) {
  & $adb -s $Device @args | Out-Null
}

function Save-Shot([string]$label) {
  $script:step++
  $n = "{0:D2}" -f $script:step
  $local = Join-Path $shotsDir ("{0}_{1}.png" -f $n, $label)
  Start-Process -FilePath $adb -ArgumentList @("-s", $Device, "exec-out", "screencap", "-p") -RedirectStandardOutput $local -NoNewWindow -Wait | Out-Null
  Write-Host "[$n] $label"
}

function Tap([int]$x, [int]$y, [int]$waitMs = 1500) {
  ADB @("shell", "input", "tap", "$x", "$y")
  Start-Sleep -Milliseconds $waitMs
}

function Input-Text([string]$text, [int]$waitMs = 800) {
  $safe = $text.Replace(" ", "%s")
  ADB @("shell", "input", "text", $safe)
  Start-Sleep -Milliseconds $waitMs
}

function Dump-Xml() {
  $remote = "/sdcard/window_dump.xml"
  $local = Join-Path $runDir "window_dump_latest.xml"
  ADB @("shell", "uiautomator", "dump")
  & $adb -s $Device pull $remote $local | Out-Null
  if (-not (Test-Path $local)) {
    return $null
  }
  return $local
}

function Get-BoundsCenterByContains([string]$xmlPath, [string]$fragment) {
  $raw = Get-Content $xmlPath -Raw
  $esc = [Regex]::Escape($fragment)
  $pattern = 'text="([^"]*' + $esc + '[^"]*)"[\s\S]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
  $match = [regex]::Match(
    $raw,
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if (-not $match.Success) {
    return $null
  }

  $x1 = [int]$match.Groups[2].Value
  $y1 = [int]$match.Groups[3].Value
  $x2 = [int]$match.Groups[4].Value
  $y2 = [int]$match.Groups[5].Value
  return @{ X = [int](($x1 + $x2) / 2); Y = [int](($y1 + $y2) / 2) }
}

function Tap-ByContains([string]$fragment, [int]$waitMs = 1800) {
  $xml = Dump-Xml
  if ($null -eq $xml) {
    return $false
  }
  $pos = Get-BoundsCenterByContains -xmlPath $xml -fragment $fragment
  if ($null -eq $pos) {
    return $false
  }

  Tap -x $pos.X -y $pos.Y -waitMs $waitMs
  return $true
}

function Any-Text-Exists([string[]]$fragments) {
  $xml = Dump-Xml
  if ($null -eq $xml) {
    return $false
  }
  $raw = Get-Content $xml -Raw
  foreach ($f in $fragments) {
    if ($raw -match [Regex]::Escape($f)) {
      return $true
    }
  }
  return $false
}

$logFile = Join-Path $logsDir "logcat_reactnativejs.txt"
$logcatProc = Start-Process -FilePath $adb -ArgumentList @("-s", $Device, "logcat", "-v", "time", "ReactNativeJS:I", "*:S") -RedirectStandardOutput $logFile -NoNewWindow -PassThru

$remoteVideo = "/sdcard/phase2_validation_$ts.mp4"
$screenProc = Start-Process -FilePath $adb -ArgumentList @("-s", $Device, "shell", "screenrecord", "--bit-rate", "6000000", "--time-limit", "180", $remoteVideo) -NoNewWindow -PassThru

try {
  ADB @("shell", "am", "start", "-n", "com.tipolt.evolucaofullv2/.MainActivity")
  Start-Sleep -Seconds 4
  Save-Shot "app_opened"

  if (Any-Text-Exists @("Cadastrar", "Criar minha conta", "Entrar")) {
    Tap-ByContains "Entrar" 1800 | Out-Null
    if (-not (Any-Text-Exists @("Entrar na conta", "Entrar agora"))) {
      Tap-ByContains "Entrar" 1800 | Out-Null
    }
    Save-Shot "auth_login_tab"

    if (-not (Tap-ByContains "voce@email.com" 500)) {
      Tap 540 1520 600
    }
    Input-Text $Email

    if (-not (Tap-ByContains "Minimo 6 caracteres" 500)) {
      Tap 540 1760 600
    }
    Input-Text $Password
    Save-Shot "auth_filled"

    if (-not (Tap-ByContains "Entrar agora" 3500)) {
      Tap 540 2050 3200
    }
    Save-Shot "auth_after_submit"
  }

  if (Any-Text-Exists @("Cadastrar", "Criar minha conta", "Entrar na conta", "Entrar agora")) {
    Write-Host "WARN: app ainda em auth apos tentativa de login"

    # Fallback robusto: registra uma conta nova para desbloquear os fluxos internos.
    $fallbackEmail = "phase2_" + $ts + "@example.com"

    Tap-ByContains "Cadastrar" 1800 | Out-Null
    Save-Shot "auth_register_tab"

    if (-not (Tap-ByContains "Como gostaria" 500)) {
      Tap 540 1260 600
    }
    Input-Text "QA Phase2"

    if (-not (Tap-ByContains "seu@email.com" 500)) {
      Tap 540 1510 600
    }
    Input-Text $fallbackEmail

    if (-not (Tap-ByContains "6 caracteres" 500)) {
      Tap 540 1760 600
    }
    Input-Text $Password
    Save-Shot "auth_register_filled"

    if (-not (Tap-ByContains "Cadastrar" 3800)) {
      Tap 540 2050 3800
    }
    Save-Shot "auth_after_register"
  }

  Tap 270 2137 2600
  Save-Shot "tab_treino"

  # Caminho heuristico para abrir um detalhe de exercicio.
  Tap 540 1537 2800
  Save-Shot "treino_after_primary_tap"
  Tap 540 960 2600
  Save-Shot "treino_after_secondary_tap"

  # Tenta localizar os controles de video em ate 4 tentativas.
  for ($i = 1; $i -le 4; $i++) {
    if (Any-Text-Exists @("Abrir video", "Tentar player interno", "Abrir em tela cheia")) {
      $script:videoFound = $true
      break
    }

    Tap 540 960 2200
    if ($i -ge 2) {
      Tap 540 780 2200
    }
    Save-Shot ("video_seek_attempt_" + $i)
  }

  if ($script:videoFound) {
    if (Tap-ByContains "Abrir video" 3000) {
      $script:externalOpenTriggered = $true
      Save-Shot "video_external_open_triggered"
      ADB @("shell", "input", "keyevent", "4")
      Start-Sleep -Seconds 2
    }

    if (Tap-ByContains "Tentar player interno" 5000) {
      $script:internalPlayerTriggered = $true
      Save-Shot "video_internal_player_triggered"
    }

    if (Tap-ByContains "Abrir em tela cheia" 3500) {
      $script:fullscreenTriggered = $true
      Save-Shot "video_fullscreen_triggered"
      ADB @("shell", "input", "keyevent", "4")
      Start-Sleep -Seconds 2
    }

    Tap-ByContains "Fechar player" 2200 | Out-Null
    Save-Shot "video_player_closed"

    # Lifecycle: background/foreground
    ADB @("shell", "input", "keyevent", "3")
    Start-Sleep -Seconds 2
    Save-Shot "app_backgrounded"

    ADB @("shell", "am", "start", "-n", "com.tipolt.evolucaofullv2/.MainActivity")
    Start-Sleep -Seconds 3
    Save-Shot "app_restored"
  }

  Tap 990 2137 2800
  Save-Shot "tab_profile"

  if (Tap-ByContains "Encerrar sessao completa" 4200) {
    $script:logoutTriggered = $true
    Save-Shot "logout_triggered"
  }

  ADB @("shell", "am", "force-stop", "com.tipolt.evolucaofullv2")
  Start-Sleep -Seconds 2
  ADB @("shell", "am", "start", "-n", "com.tipolt.evolucaofullv2/.MainActivity")
  Start-Sleep -Seconds 4
  Save-Shot "relaunch_after_logout"

  if (Any-Text-Exists @("Cadastrar", "Criar minha conta", "Entrar")) {
    $script:authScreenAfterRelaunch = $true
  }
}
finally {
  try {
    ADB @("shell", "pkill", "-INT", "screenrecord")
  } catch {
    # noop
  }

  Start-Sleep -Seconds 2

  if ($screenProc -and -not $screenProc.HasExited) {
    try { Stop-Process -Id $screenProc.Id -Force } catch {}
  }

  if ($logcatProc -and -not $logcatProc.HasExited) {
    try { Stop-Process -Id $logcatProc.Id -Force } catch {}
  }

  $videoLocal = Join-Path $runDir "phase2_validation.mp4"
  & $adb -s $Device pull $remoteVideo $videoLocal | Out-Null
}

$summaryLines = @(
  "device=$Device",
  "runDir=$runDir",
  "videoFound=$script:videoFound",
  "externalOpenTriggered=$script:externalOpenTriggered",
  "internalPlayerTriggered=$script:internalPlayerTriggered",
  "fullscreenTriggered=$script:fullscreenTriggered",
  "logoutTriggered=$script:logoutTriggered",
  "authScreenAfterRelaunch=$script:authScreenAfterRelaunch",
  "finishedAt=$(Get-Date -Format o)"
)

$summaryPath = Join-Path $runDir "summary.txt"
Set-Content -Path $summaryPath -Value $summaryLines

Write-Host "PHASE2_VALIDATION_DONE runDir=$runDir"
Write-Host "videoFound=$script:videoFound external=$script:externalOpenTriggered internal=$script:internalPlayerTriggered fullscreen=$script:fullscreenTriggered"
Write-Host "logoutTriggered=$script:logoutTriggered authAfterRelaunch=$script:authScreenAfterRelaunch"
