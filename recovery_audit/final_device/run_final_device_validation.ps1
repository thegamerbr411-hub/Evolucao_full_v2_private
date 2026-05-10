param(
  [string]$Device = "RQ8T209ZTAF",
  [string]$OutRoot = "F:\projetos\evolucao app\recovery_audit\final_device"
)

$ErrorActionPreference = "Stop"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  throw "adb nao encontrado em $adb"
}

$pkg = "com.tipolt.evolucaofullv2"
$activity = "$pkg/.MainActivity"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $OutRoot "run_$ts"
$shotsDir = Join-Path $outDir "screenshots"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $shotsDir | Out-Null

$summary = New-Object System.Collections.Generic.List[string]
$script:step = 0

function Log-Step([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
  Write-Host $line
  $summary.Add($line)
}

function Save-Shot([string]$label) {
  $script:step++
  $n = "{0:D2}" -f $script:step
  $remote = "/sdcard/final_val_shot.png"
  $local = Join-Path $shotsDir ("{0}_{1}.png" -f $n, $label)
  & $adb -s $Device shell screencap -p $remote | Out-Null
  & $adb -s $Device pull $remote $local | Out-Null
  Log-Step "SHOT $n $label"
}

function Tap([int]$x, [int]$y, [int]$waitMs = 1200) {
  & $adb -s $Device shell input tap $x $y | Out-Null
  Start-Sleep -Milliseconds $waitMs
}

function Press-Back([int]$waitMs = 1000) {
  & $adb -s $Device shell input keyevent 4 | Out-Null
  Start-Sleep -Milliseconds $waitMs
}

function Input-Text([string]$text, [int]$waitMs = 700) {
  $safe = $text.Replace(" ", "%s").Replace("@", "\\@").Replace(".", "\\.").Replace("+", "\\+")
  & $adb -s $Device shell input text $safe | Out-Null
  Start-Sleep -Milliseconds $waitMs
}

function Dump-Xml() {
  $remote = "/sdcard/window_dump_final_validation.xml"
  $local = Join-Path $outDir "window_dump.xml"
  & $adb -s $Device shell uiautomator dump $remote | Out-Null
  & $adb -s $Device pull $remote $local | Out-Null
  return $local
}

function Get-RawXml() {
  $xml = Dump-Xml
  return Get-Content $xml -Raw
}

function Get-BoundsCenterByText([string]$xmlRaw, [string]$text) {
  $esc = [Regex]::Escape($text)
  $pattern = 'text="' + $esc + '"[\s\S]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
  $m = [regex]::Match($xmlRaw, $pattern)
  if (-not $m.Success) { return $null }
  $x1 = [int]$m.Groups[1].Value
  $y1 = [int]$m.Groups[2].Value
  $x2 = [int]$m.Groups[3].Value
  $y2 = [int]$m.Groups[4].Value
  return @{ X = [int](($x1 + $x2) / 2); Y = [int](($y1 + $y2) / 2) }
}

function Tap-ByText([string]$text, [int]$waitMs = 1700) {
  $raw = Get-RawXml
  $pos = Get-BoundsCenterByText -xmlRaw $raw -text $text
  if ($null -eq $pos) { return $false }
  Tap -x $pos.X -y $pos.Y -waitMs $waitMs
  return $true
}

function Contains-Any([string]$xmlRaw, [string[]]$terms) {
  foreach ($t in $terms) {
    if ($xmlRaw -match [Regex]::Escape($t)) { return $true }
  }
  return $false
}

Log-Step "Iniciando validacao final em device $Device"

& $adb -s $Device shell am start -n $activity | Out-Null
Start-Sleep -Seconds 4
Save-Shot "app_open"

$xmlStart = Get-RawXml
$isAuthScreen = Contains-Any -xmlRaw $xmlStart -terms @("Criar minha conta", "Cadastrar", "Entrar na conta", "Entrar")

$testEmail = "qa.final.$ts@gmail.com"
$testPass = "QaFinal123456"
$testName = "QA Final"

if ($isAuthScreen) {
  Log-Step "Tela de auth detectada. Executando cadastro real Firebase."

  [void](Tap-ByText "Cadastrar" 1200)
  Save-Shot "auth_register_tab"

  Tap 540 1400 500
  Input-Text $testName
  Tap 540 1570 500
  Input-Text $testEmail
  Tap 540 1740 500
  Input-Text $testPass
  Save-Shot "auth_register_filled"

  Tap 540 2050 6000
  Save-Shot "auth_register_submit_result"

  $postRegister = Get-RawXml
  if (Contains-Any -xmlRaw $postRegister -terms @("Home", "Treino", "Perfil", "Nutri", "Coach", "Social")) {
    Log-Step "Cadastro OK e navegacao pos-cadastro alcançou area autenticada."
  } else {
    Log-Step "Cadastro nao levou claramente para area autenticada dentro do timeout."
  }
} else {
  Log-Step "Tela de auth nao detectada no boot; app ja entrou autenticado."
}

# Persistencia de sessao: restart app e verificar retorno autenticado
& $adb -s $Device shell am force-stop $pkg | Out-Null
Start-Sleep -Seconds 2
& $adb -s $Device shell am start -n $activity | Out-Null
Start-Sleep -Seconds 5
Save-Shot "after_restart_session_restore"

$afterRestart = Get-RawXml
if (Contains-Any -xmlRaw $afterRestart -terms @("Home", "Treino", "Perfil", "Nutri", "Coach", "Social")) {
  Log-Step "Persistencia de sessao OK apos restart."
} else {
  Log-Step "Persistencia de sessao NAO confirmada apos restart."
}

# Navegacao por todas as abas
Tap 90 2137 1800
Save-Shot "tab_home"
Tap 270 2137 2200
Save-Shot "tab_treino"
Tap 450 2137 2200
Save-Shot "tab_nutricao"
Tap 630 2137 2200
Save-Shot "tab_coach"
Tap 810 2137 2200
Save-Shot "tab_social"
Tap 990 2137 2200
Save-Shot "tab_perfil"
Log-Step "Navegacao basica por todas as abas executada."

# Treinos: abertura e navegacao
Tap 270 2137 2200
Save-Shot "treino_hub"
Tap 540 1537 3500
Save-Shot "treino_detalhe"
Tap 540 1400 1800
Save-Shot "treino_execucao"
Press-Back 1200
Press-Back 1200
Save-Shot "treino_back_flow"
Log-Step "Fluxo de treinos exercitado (abrir, detalhe, execucao, voltar)."

# Videos: tentativa de abrir area de videos e player/fullscreen
$openedVideo = $false
if (Tap-ByText "Videos" 2600 -or Tap-ByText "Vídeos" 2600 -or Tap-ByText "Video" 2600 -or Tap-ByText "Vídeo" 2600) {
  $openedVideo = $true
  Save-Shot "videos_lista"
  Tap 540 1100 3000
  Save-Shot "video_detalhe_or_player"
  Tap 980 120 1500
  Save-Shot "video_fullscreen_attempt"
  Press-Back 1200
  Press-Back 1200
}
if ($openedVideo) {
  Log-Step "Fluxo de videos exercitado com tentativa de player/fullscreen."
} else {
  Log-Step "Nao foi possivel localizar entrada explicita de Videos por texto nesta build."
}

# Admin: entrada e CRUD rapido
Tap 990 2137 2000
if (-not (Tap-ByText "Abrir painel Admin" 2500)) {
  [void](Tap-ByText "Abrir configuracoes Admin" 2500)
}
Save-Shot "admin_entry"

Tap 300 920 800
Input-Text "ExercicioFinal$ts"
Tap 540 1080 800
Tap 540 1320 1400
Save-Shot "admin_create_exercise"

Tap 300 1460 800
Input-Text "AlimentoFinal$ts"
Tap 300 1660 400
Input-Text "100g"
Tap 300 1760 400
Input-Text "120"
Tap 300 1860 400
Input-Text "10"
Tap 300 1960 400
Input-Text "8"
Tap 300 2060 400
Input-Text "4"
Tap 540 2120 1400
Save-Shot "admin_create_food"
Log-Step "Fluxo Admin com CRUD basico executado."

# Logout (procura opcao explicita)
Tap 990 2137 1800
$logoutFound = $false
if (Tap-ByText "Sair" 1500 -or Tap-ByText "Logout" 1500 -or Tap-ByText "Encerrar sessao" 1500 -or Tap-ByText "Desconectar" 1500) {
  $logoutFound = $true
  Save-Shot "logout_action_found"
} else {
  Save-Shot "logout_action_not_found"
}
if ($logoutFound) {
  Log-Step "Logout acionado via UI."
} else {
  Log-Step "Logout de sessao principal nao encontrado de forma explicita na UI testada."
}

$summaryPath = Join-Path $outDir "summary.txt"
$summary.Add("testEmail=$testEmail")
$summary.Add("testPass=$testPass")
$summary.Add("finishedAt=$(Get-Date -Format o)")
Set-Content -Path $summaryPath -Value $summary -Encoding UTF8

Write-Output "FINAL_DEVICE_VALIDATION_DONE outDir=$outDir"
