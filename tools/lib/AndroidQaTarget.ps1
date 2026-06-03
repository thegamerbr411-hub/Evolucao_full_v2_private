# Shared Android QA target resolution â€” EMULATOR-FIRST mode.
# Dot-source: . (Join-Path $PSScriptRoot 'lib\AndroidQaTarget.ps1')

$script:DefaultAvdName = 'Evolucao-QA'
$script:DefaultPackageId = 'com.tipolt.evolucaofullv2'
$script:DefaultMainActivity = 'com.tipolt.evolucaofullv2/.MainActivity'
$script:SystemImageId = 'system-images;android-34;google_apis;x86_64'

function Write-QaLog {
  param([string]$Message, [string]$Level = 'INFO')
  $line = "[QA][$Level] $Message"
  Write-Host $line -ForegroundColor $(switch ($Level) {
    'ERROR' { 'Red' }
    'WARN' { 'Yellow' }
    'OK' { 'Green' }
    default { 'Gray' }
  })
  if ($script:QaSessionLogPath) {
    Add-Content -Path $script:QaSessionLogPath -Value $line -ErrorAction SilentlyContinue
  }
}

function Resolve-AndroidSdk {
  $candidates = @(
    $env:ANDROID_SDK_ROOT,
    $env:ANDROID_HOME,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  foreach ($root in $candidates) {
    $adb = Join-Path $root 'platform-tools\adb.exe'
    if (Test-Path $adb) {
      $env:ANDROID_SDK_ROOT = $root
      $env:ANDROID_HOME = $root
      $pt = Join-Path $root 'platform-tools'
      $em = Join-Path $root 'emulator'
      foreach ($p in @($pt, $em)) {
        if (($env:Path -split ';') -notcontains $p) {
          $env:Path = "$p;$env:Path"
        }
      }
      return @{
        Root = $root
        Adb = $adb
        Emulator = Join-Path $root 'emulator\emulator.exe'
        SdkManager = Resolve-CmdlineTool $root 'sdkmanager.bat'
        AvdManager = Resolve-CmdlineTool $root 'avdmanager.bat'
      }
    }
  }
  throw "Android SDK nao encontrado. Instale Android Studio ou defina ANDROID_HOME."
}

function Resolve-CmdlineTool {
  param([string]$SdkRoot, [string]$ToolName)
  $paths = @(
    (Join-Path $SdkRoot "cmdline-tools\latest\bin\$ToolName"),
    (Join-Path $SdkRoot "cmdline-tools\bin\$ToolName")
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Get-AdbDeviceList {
  param($Sdk)
  $raw = & $Sdk.Adb devices 2>&1
  $list = @()
  foreach ($line in $raw) {
    if ($line -match '^\s*(\S+)\s+(device|offline|unauthorized)\s*$') {
      $list += [PSCustomObject]@{
        Serial = $Matches[1]
        State = $Matches[2]
      }
    }
  }
  return $list
}

function Get-EmulatorSerial {
  param($Devices)
  $emu = $Devices | Where-Object { $_.State -eq 'device' -and $_.Serial -match '^emulator-' } | Select-Object -First 1
  if ($emu) { return $emu.Serial }
  return $null
}

function Wait-ForEmulatorSerial {
  param(
    $Sdk,
    [int]$TimeoutSec = 180
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $devices = Get-AdbDeviceList -Sdk $Sdk
    $emu = Get-EmulatorSerial -Devices $devices
    if ($emu) { return $emu }
    Start-Sleep -Seconds 3
  }
  return $null
}

function Get-PhysicalSerial {
  param($Devices)
  $phys = $Devices | Where-Object { $_.State -eq 'device' -and $_.Serial -notmatch '^emulator-' } | Select-Object -First 1
  if ($phys) { return $phys.Serial }
  return $null
}

function Get-QaTargetMode {
  if ($env:EVOLUCAO_QA_TARGET) { return $env:EVOLUCAO_QA_TARGET.Trim().ToLowerInvariant() }
  return 'emulator'
}

function Get-QaAdbSerial {
  param(
    $Sdk,
    [string]$PreferredSerial = '',
    [string]$Target = ''
  )

  if ([string]::IsNullOrWhiteSpace($Target)) {
    $Target = Get-QaTargetMode
  }

  $allowPhysical = ($env:EVOLUCAO_QA_ALLOW_PHYSICAL -eq '1')

  if (-not [string]::IsNullOrWhiteSpace($PreferredSerial)) {
    $pref = $PreferredSerial.Trim()
    if (-not $allowPhysical -and $Target -eq 'emulator' -and $pref -notmatch '^emulator-') {
      Write-QaLog "Serial preferido '$pref' ignorado (EMULATOR-ONLY). Use emulator ou EVOLUCAO_QA_ALLOW_PHYSICAL=1." 'WARN'
    } else {
      return $pref
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($env:EVOLUCAO_QA_SERIAL)) {
    $cached = $env:EVOLUCAO_QA_SERIAL.Trim()
    if ($allowPhysical -or $cached -match '^emulator-' -or $Target -ne 'emulator') {
      return $cached
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($env:ADB_DEVICE)) {
    $adbDev = $env:ADB_DEVICE.Trim()
    if ($allowPhysical -or $adbDev -match '^emulator-' -or $Target -ne 'emulator') {
      return $adbDev
    }
  }

  $devices = Get-AdbDeviceList -Sdk $Sdk
  $emu = Get-EmulatorSerial -Devices $devices
  $phys = Get-PhysicalSerial -Devices $devices

  switch ($Target) {
    'physical' {
      if (-not $allowPhysical -and $env:EVOLUCAO_QA_TARGET -ne 'physical') {
        Write-QaLog 'Modo padrao e emulator; physical ignorado. Defina EVOLUCAO_QA_ALLOW_PHYSICAL=1.' 'WARN'
      }
      if ($phys -and ($allowPhysical -or $env:EVOLUCAO_QA_TARGET -eq 'physical')) {
        return $phys.Serial
      }
      throw "EVOLUCAO_QA_TARGET=physical mas nenhum device fisico em estado 'device'."
    }
    'auto' {
      if ($emu) { return $emu.Serial }
      if ($allowPhysical -and $phys) { return $phys.Serial }
      return $null
    }
    default {
      if ($emu) { return $emu.Serial }
      if ($null -eq $emu) {
        Write-QaLog "Nenhum emulador ativo. Rode: .\tools\start_emulator_qa.ps1 -CreateAvdIfMissing" 'ERROR'
      }
      return $null
    }
  }
}

function Test-AvdExists {
  param($Sdk, [string]$AvdName)
  if (-not $Sdk.AvdManager) { return $false }
  $out = & $Sdk.AvdManager list avd 2>&1 | Out-String
  return $out -match [regex]::Escape("Name: $AvdName")
}

function Install-QaSystemImageIfNeeded {
  param($Sdk)
  if (-not $Sdk.SdkManager) {
    Write-QaLog "sdkmanager nao encontrado; pule criacao automatica de AVD." 'WARN'
    return $false
  }
  Write-QaLog "Instalando system image (pode demorar): $script:SystemImageId"
  $yes = "y" * 20
  $yes | & $Sdk.SdkManager $script:SystemImageId 2>&1 | Out-Null
  return $LASTEXITCODE -eq 0
}

function New-QaAvdIfMissing {
  param(
    $Sdk,
    [string]$AvdName = $script:DefaultAvdName,
    [switch]$ForceInstallImage
  )
  if (Test-AvdExists -Sdk $Sdk -AvdName $AvdName) {
    Write-QaLog "AVD ja existe: $AvdName" 'OK'
    return $true
  }
  if (-not $Sdk.AvdManager) {
    Write-QaLog "avdmanager nao encontrado." 'ERROR'
    return $false
  }
  if ($ForceInstallImage) {
    Install-QaSystemImageIfNeeded -Sdk $Sdk | Out-Null
  }
  $deviceProfile = 'pixel_6'
  if ($Sdk.AvdManager) {
    $deviceList = & $Sdk.AvdManager list device 2>&1 | Out-String
    if ($deviceList -notmatch 'pixel_6') {
      $deviceProfile = 'pixel_5'
      Write-QaLog 'pixel_6 nao listado; usando pixel_5.' 'WARN'
    }
  }
  Write-QaLog "Criando AVD $AvdName ($deviceProfile, API 34, x86_64)..."
  $createArgs = @(
    'create', 'avd',
    '-n', $AvdName,
    '-k', $script:SystemImageId,
    '-d', $deviceProfile,
    '--force'
  )
  echo no | & $Sdk.AvdManager @createArgs 2>&1 | Out-Null
  if (Test-AvdExists -Sdk $Sdk -AvdName $AvdName) {
    Write-QaLog "AVD criado: $AvdName" 'OK'
    return $true
  }
  Write-QaLog "Falha ao criar AVD $AvdName" 'ERROR'
  return $false
}

function Start-QaEmulator {
  param(
    $Sdk,
    [string]$AvdName = $script:DefaultAvdName,
    [switch]$NoSnapshotLoad
  )
  if (-not (Test-Path $Sdk.Emulator)) {
    throw "emulator.exe nao encontrado: $($Sdk.Emulator)"
  }
  $accel = & $Sdk.Emulator -accel-check 2>&1 | Out-String
  Write-QaLog "accel-check: $($accel.Trim().Replace("`n", ' | '))"
  $args = @('-avd', $AvdName, '-gpu', 'auto')
  if ($NoSnapshotLoad) { $args += '-no-snapshot-load' }
  Write-QaLog "Iniciando emulator -avd $AvdName (background)..."
  Start-Process -FilePath $Sdk.Emulator -ArgumentList $args -WindowStyle Normal | Out-Null
}

function Wait-EmulatorBoot {
  param(
    $Sdk,
    [string]$Serial = '',
    [int]$TimeoutSec = 180
  )
  if (-not [string]::IsNullOrWhiteSpace($Serial)) {
    & $Sdk.Adb -s $Serial wait-for-device 2>&1 | Out-Null
  } else {
    & $Sdk.Adb wait-for-device 2>&1 | Out-Null
  }
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $booted = $false
  while ((Get-Date) -lt $deadline) {
    if (-not [string]::IsNullOrWhiteSpace($Serial)) {
      $state = (& $Sdk.Adb -s $Serial get-state 2>&1) -join ''
      if ($state -notmatch 'device') {
        Start-Sleep -Seconds 2
        continue
      }
      $boot = (& $Sdk.Adb -s $Serial shell getprop sys.boot_completed 2>&1) -join ''
      $boot = $boot.Trim()
      if ($boot -eq '1') {
        $booted = $true
        break
      }
    } else {
      $boot = (& $Sdk.Adb shell getprop sys.boot_completed 2>&1) -join ''
      if (($boot.Trim()) -eq '1') {
        $booted = $true
        break
      }
    }
    Start-Sleep -Seconds 3
  }
  if (-not $booted) {
    throw "Emulator boot timeout apos ${TimeoutSec}s"
  }
  Start-Sleep -Seconds 2
  Write-QaLog "Emulator boot completo." 'OK'
}

function Set-MetroReverse {
  param(
    $Sdk,
    [string]$Serial,
    [int[]]$Ports = @(8081, 3000, 8082)
  )
  foreach ($port in $Ports) {
    $out = & $Sdk.Adb -s $Serial reverse "tcp:${port}" "tcp:${port}" 2>&1
    Write-QaLog "adb reverse tcp:${port} -> $($out -join ' ')"
  }
}

function Test-MetroAvailable {
  param([int]$TimeoutSec = 3)
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
    return ($r.StatusCode -eq 200)
  } catch {
    try {
      $r2 = Invoke-WebRequest -Uri 'http://127.0.0.1:8081' -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
      return ($r2.StatusCode -ge 200 -and $r2.StatusCode -lt 500)
    } catch {
      return $false
    }
  }
}

function Get-QaSessionDir {
  param([string]$RepoRoot)
  $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
  $dir = Join-Path $RepoRoot "qa\emulator_sessions\$ts"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Invoke-AdbShell {
  param($Sdk, [string]$Serial, [string[]]$ShellArgs)
  & $Sdk.Adb -s $Serial shell @ShellArgs 2>&1
}

function Clear-AppData {
  param($Sdk, [string]$Serial, [string]$PackageId = $script:DefaultPackageId)
  & $Sdk.Adb -s $Serial shell pm clear $PackageId 2>&1 | Out-Null
  Write-QaLog "pm clear $PackageId"
}

function Start-AppMainActivity {
  param($Sdk, [string]$Serial, [string]$Activity = $script:DefaultMainActivity)
  $prevNativeErr = $global:PSNativeCommandUseErrorActionPreference
  $prevEap = $ErrorActionPreference
  try {
    $global:PSNativeCommandUseErrorActionPreference = $false
    $ErrorActionPreference = 'Continue'
    $startOut = cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell am start -n $Activity 2>&1"
  } finally {
    $global:PSNativeCommandUseErrorActionPreference = $prevNativeErr
    $ErrorActionPreference = $prevEap
  }
  if ($LASTEXITCODE -ne 0) {
    throw "am start falhou: $startOut"
  }
  Write-QaLog "am start $Activity"
}

function Stop-App {
  param($Sdk, [string]$Serial, [string]$PackageId = $script:DefaultPackageId)
  & $Sdk.Adb -s $Serial shell am force-stop $PackageId 2>&1 | Out-Null
}

function Get-LogcatSnapshot {
  param(
    $Sdk,
    [string]$Serial,
    [string]$Pattern,
    [int]$TailLines = 400
  )
  $raw = & $Sdk.Adb -s $Serial logcat -d -t $TailLines 2>&1 | Out-String
  if ([string]::IsNullOrWhiteSpace($Pattern)) {
    return $raw
  }
  return ($raw -split "`n" | Where-Object { $_ -match $Pattern }) -join "`n"
}

function Test-AuthBundleTags {
  param([string]$LogText)
  $hasConfigured = $LogText -match '\[AUTH\]\[GOOGLE\]\[CONFIGURED\]'
  $hasIdTokenFlow = ($LogText -match 'android_native_id_token') -or ($LogText -match 'response_type=id_token') -or ($LogText -match 'responseType.*id_token')
  $hasOldFlow = ($LogText -match 'web_pkce') -or ($LogText -match 'responseType=code') -or ($LogText -match 'exchangeCodeAsync')
  return @{
    configured = [bool]$hasConfigured
    nativeIdToken = [bool]$hasIdTokenFlow
    oldFlowDetected = [bool]$hasOldFlow
    pass = $hasConfigured -and $hasIdTokenFlow -and (-not $hasOldFlow)
  }
}

function Test-HydrationTags {
  param([string]$LogText)
  $hasAuthRestore = $LogText -match 'authRestoreDurationMs'
  $hasHydrate = $LogText -match 'app_store\.hydrate|hydrationDurationMs|RESTORING_AUTH|NAVIGATION_READY'
  return @{
    authRestore = [bool]$hasAuthRestore
    hydrate = [bool]$hasHydrate
    pass = $hasAuthRestore -or $hasHydrate
  }
}

function Publish-RuntimeSessionSummary {
  param(
    [string]$RepoRoot,
    [object]$Summary,
    [string]$SessionDir = ''
  )
  $runtimeDir = Join-Path $RepoRoot 'qa\runtime'
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $json = $Summary | ConvertTo-Json -Depth 8
  $json | Set-Content -Path (Join-Path $runtimeDir 'session_summary.json') -Encoding UTF8
  if ($SessionDir) {
    $json | Set-Content -Path (Join-Path $SessionDir 'session_summary.json') -Encoding UTF8
  }
}

function Get-EmulatorDisplaySize {
  param($Sdk, [string]$Serial)
  $out = (& $Sdk.Adb -s $Serial shell wm size 2>&1) -join ' '
  if ($out -match 'Physical size:\s*(\d+)x(\d+)') {
    return @{ Width = [int]$Matches[1]; Height = [int]$Matches[2] }
  }
  if ($out -match 'Override size:\s*(\d+)x(\d+)') {
    return @{ Width = [int]$Matches[1]; Height = [int]$Matches[2] }
  }
  return @{ Width = 1080; Height = 2400 }
}

function Invoke-AdbTap {
  param($Sdk, [string]$Serial, [int]$X, [int]$Y)
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell input tap $X $Y 2>nul" | Out-Null
  Start-Sleep -Milliseconds 450
}

function Save-EmulatorScreenshot {
  param($Sdk, [string]$Serial, [string]$OutPath)
  $dir = Split-Path $OutPath -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $remote = '/sdcard/qa_screenshot.png'
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell screencap -p $remote 2>nul" | Out-Null
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial pull $remote `"$OutPath`" 2>nul" | Out-Null
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell rm $remote 2>nul" | Out-Null
  return (Test-Path $OutPath)
}

function Save-EmulatorScreenshotExecOut {
  param($Sdk, [string]$Serial, [string]$OutPath)
  $dir = Split-Path $OutPath -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial exec-out screencap -p > `"$OutPath`" 2>nul"
  } finally {
    $ErrorActionPreference = $prevEap
  }
  if ((Test-Path $OutPath) -and (Get-Item $OutPath).Length -gt 500) { return $true }
  return Save-EmulatorScreenshot -Sdk $Sdk -Serial $Serial -OutPath $OutPath
}

function Get-UiXmlSnapshotBounded {
  param(
    $Sdk,
    [string]$Serial,
    [int]$TimeoutSec = 10,
    [string]$RemotePath = '/sdcard/qa_ui.xml'
  )
  $adb = $Sdk.Adb
  $job = Start-Job -ScriptBlock {
    param($AdbPath, $Ser, $Remote)
    $null = cmd.exe /c "`"$AdbPath`" -s $Ser shell uiautomator dump $Remote 2>nul"
    Start-Sleep -Milliseconds 400
    $raw = cmd.exe /c "`"$AdbPath`" -s $Ser shell cat $Remote 2>nul"
    return ($raw | Out-String).Trim()
  } -ArgumentList $adb, $Serial, $RemotePath

  $waited = Wait-Job -Job $job -Timeout $TimeoutSec
  if (-not $waited) {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    return @{ xml = ''; timedOut = $true }
  }

  $joined = Receive-Job -Job $job -ErrorAction SilentlyContinue
  Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
  if ($joined -and $joined.Length -gt 200 -and $joined -match '<hierarchy') {
    return @{ xml = $joined; timedOut = $false }
  }
  return @{ xml = ''; timedOut = $false }
}

function Save-QaCaptureStep {
  param(
    $Sdk,
    [string]$Serial,
    [string]$OutDir,
    [string]$BaseName,
    [string]$LogcatPattern = '',
    [int]$XmlTimeoutSec = 10
  )
  if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  }
  $png = Join-Path $OutDir ($BaseName + '.png')
  $xmlPath = Join-Path $OutDir ($BaseName + '.xml')

  $pngOk = Save-EmulatorScreenshotExecOut -Sdk $Sdk -Serial $Serial -OutPath $png
  $screenshotFallbackUsed = $pngOk

  $snap = Get-UiXmlSnapshotBounded -Sdk $Sdk -Serial $Serial -TimeoutSec $XmlTimeoutSec
  $xml = $snap.xml
  $dumpTimedOut = [bool]$snap.timedOut
  $xmlOk = -not [string]::IsNullOrWhiteSpace($xml)
  if ($xmlOk) {
    $xml | Set-Content -Path $xmlPath -Encoding UTF8
  } else {
    Set-Content -Path $xmlPath -Value '<!-- uiautomator unavailable or timeout -->' -Encoding UTF8
  }

  if ($LogcatPattern) {
    $log = Get-LogcatSnapshot -Sdk $Sdk -Serial $Serial -Pattern $LogcatPattern -TailLines 250
    $log | Set-Content -Path (Join-Path $OutDir ($BaseName + '_logcat.txt')) -Encoding UTF8
  }

  return @{
    xml = $xml
    pngOk = [bool]$pngOk
    xmlOk = [bool]$xmlOk
    dumpTimedOut = $dumpTimedOut
    screenshotFallbackUsed = [bool]$screenshotFallbackUsed
  }
}

function Get-UiXmlSnapshot {
  param(
    $Sdk,
    [string]$Serial,
    [string]$RemotePath = '/sdcard/qa_ui.xml',
    [int]$MaxAttempts = 3
  )
  for ($i = 0; $i -lt $MaxAttempts; $i++) {
    $snap = Get-UiXmlSnapshotBounded -Sdk $Sdk -Serial $Serial -TimeoutSec 10 -RemotePath $RemotePath
    if ($snap.xml) { return $snap.xml }
    Start-Sleep -Milliseconds 400
  }
  return ''
}

function Test-UiHasAnyNeedle {
  param(
    $Sdk,
    [string]$Serial,
    [string[]]$Needles,
    [int]$TimeoutSec = 12,
    [int]$PollIntervalMs = 900
  )
  if (-not $Needles) { return $false }

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
      foreach ($n in $Needles) {
        if ([string]::IsNullOrWhiteSpace($n)) { continue }
        if ($xml -and $xml.Contains($n)) { return $true }
      }
    } catch {
      # Ignore transient adb/uiautomator issues; keep polling until timeout.
    }
    Start-Sleep -Milliseconds $PollIntervalMs
  }
  return $false
}

function Test-UiHasAllNeedles {
  param(
    $Sdk,
    [string]$Serial,
    [string[]]$Needles,
    [int]$TimeoutSec = 12,
    [int]$PollIntervalMs = 900
  )
  if (-not $Needles) { return $true }

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $allOk = $true
    try {
      $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
      foreach ($n in $Needles) {
        if ([string]::IsNullOrWhiteSpace($n)) { continue }
        if (-not ($xml -and $xml.Contains($n))) { $allOk = $false; break }
      }
    } catch {
      $allOk = $false
    }
    if ($allOk) { return $true }
    Start-Sleep -Milliseconds $PollIntervalMs
  }
  return $false
}

$script:MainTabsNeedles = @(
  'tab-home', 'tab_home', 'screen_home',
  'tab-treino', 'tab_treinos', 'screen_treinos',
  'tab-nutricao', 'tab_nutricao',
  'tab-conversa', 'tab_coach',
  'tab_mais', 'tab_more', 'tab-mais'
)

$script:LoginScreenNeedles = @(
  'Entrar', 'Cadastrar', 'Esqueci', 'screen_login', 'Evolu', 'VERIFICA'
)

$script:OverlayNeedles = @(
  'Allow', 'notifications', 'notifica', "Don't allow", 'permission',
  'Permitir', 'Não permitir', 'Nao permitir', 'Enquanto o app estiver em uso',
  'permission_allow_button', 'permissioncontroller'
)

$script:OverlayAllowTapPatterns = @(
  'permission_allow_foreground_only_button',
  'permission_allow_button',
  'text="Permitir"',
  'text="Allow"',
  'text="OK"',
  'Enquanto o app estiver em uso',
  'While using the app',
  'android:id/button1'
)

$script:OverlayDenyPatterns = @(
  "Don't allow", 'permission_deny_button', 'text="Não permitir"', 'text="Nao permitir"', 'text="Deny"'
)

function Test-AndroidOverlayPresent {
  param([string]$Xml)
  return (Test-UiXmlHasNeedle -Xml $Xml -Needles $script:OverlayNeedles)
}

function Get-OverlayType {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return 'unknown' }
  $lower = $Xml.ToLowerInvariant()
  if ($lower -match 'notification|notifica') { return 'notification' }
  if ($lower -match 'permissioncontroller|permission_allow|system permission') { return 'system_permission' }
  if (Test-AndroidOverlayPresent -Xml $Xml) { return 'unknown' }
  return $null
}

function Get-UiNodeBoundsCenter {
  param([string]$NodeFragment)
  if ($NodeFragment -match 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
    $x1 = [int]$Matches[1]; $y1 = [int]$Matches[2]
    $x2 = [int]$Matches[3]; $y2 = [int]$Matches[4]
    return @{ X = [int](($x1 + $x2) / 2); Y = [int](($y1 + $y2) / 2) }
  }
  return $null
}

function Invoke-AdbTapFromBounds {
  param($Sdk, [string]$Serial, [string]$BoundsFragment)
  $center = Get-UiNodeBoundsCenter -NodeFragment $BoundsFragment
  if (-not $center) { return $false }
  Invoke-AdbTap -Sdk $Sdk -Serial $Serial -X $center.X -Y $center.Y
  return $true
}

function Find-SafeOverlayAllowNode {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $null }
  $nodes = [regex]::Matches($Xml, '<node[^>]+/?>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  foreach ($pattern in $script:OverlayAllowTapPatterns) {
    foreach ($m in $nodes) {
      $node = $m.Value
      if (-not $node.Contains($pattern)) { continue }
      $isDeny = $false
      foreach ($deny in $script:OverlayDenyPatterns) {
        if ($node.Contains($deny)) { $isDeny = $true; break }
      }
      if ($isDeny) { continue }
      if ($node -match 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') { return $node }
    }
  }
  return $null
}

function Invoke-DismissAndroidOverlay {
  param(
    $Sdk,
    [string]$Serial,
    [string]$Xml,
    [int]$FallbackX = 0,
    [int]$FallbackY = 0
  )
  $node = Find-SafeOverlayAllowNode -Xml $Xml
  if ($node) {
    $tapped = Invoke-AdbTapFromBounds -Sdk $Sdk -Serial $Serial -BoundsFragment $node
    if ($tapped) { return $true }
  }
  if ($FallbackX -gt 0 -and $FallbackY -gt 0) {
    Invoke-AdbTap -Sdk $Sdk -Serial $Serial -X $FallbackX -Y $FallbackY
    return $true
  }
  $size = Get-EmulatorDisplaySize -Sdk $Sdk -Serial $Serial
  $fx = [int]($size.Width * 0.72)
  $fy = [int]($size.Height * 0.58)
  Invoke-AdbTap -Sdk $Sdk -Serial $Serial -X $fx -Y $fy
  return $true
}

function Get-FileMd5Hash {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  return (Get-FileHash -Path $Path -Algorithm MD5).Hash
}

function Get-UiVisibleSignals {
  param([string]$Xml)
  $texts = New-Object System.Collections.Generic.List[string]
  $testIds = New-Object System.Collections.Generic.List[string]
  if ([string]::IsNullOrWhiteSpace($Xml)) {
    return @{ texts = @(); testIds = @() }
  }
  foreach ($m in [regex]::Matches($Xml, 'text="([^"]*)"')) {
    $v = $m.Groups[1].Value.Trim()
    if ($v -and $texts -notcontains $v) { [void]$texts.Add($v) }
  }
  foreach ($m in [regex]::Matches($Xml, 'content-desc="([^"]*)"')) {
    $v = $m.Groups[1].Value.Trim()
    if ($v -and $testIds -notcontains $v) { [void]$testIds.Add($v) }
  }
  foreach ($m in [regex]::Matches($Xml, 'resource-id="([^"]*)"')) {
    $v = $m.Groups[1].Value.Trim()
    if ($v -and $testIds -notcontains $v) { [void]$testIds.Add($v) }
  }
  return @{ texts = @($texts); testIds = @($testIds) }
}

function Test-UiXmlHasNeedle {
  param([string]$Xml, [string[]]$Needles)
  if ([string]::IsNullOrWhiteSpace($Xml) -or -not $Needles) { return $false }
  foreach ($n in $Needles) {
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    if ($Xml.Contains($n)) { return $true }
  }
  return $false
}

function Find-UiNodeFragment {
  param(
    [string]$Xml,
    [string[]]$Needles,
    [switch]$ClickableOnly
  )
  if ([string]::IsNullOrWhiteSpace($Xml) -or -not $Needles) { return $null }
  $nodes = [regex]::Matches($Xml, '<node[^>]+/?>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  foreach ($n in $Needles) {
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    foreach ($m in $nodes) {
      $node = $m.Value
      if (-not ($node.Contains($n))) { continue }
      if ($ClickableOnly -and $node -notmatch 'clickable="true"') { continue }
      if ($node -match 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') { return $node }
    }
  }
  return $null
}

function Invoke-TapUiNeedle {
  param(
    $Sdk,
    [string]$Serial,
    [string]$Xml,
    [string[]]$Needles,
    [switch]$ClickableOnly,
    [switch]$RefreshXml
  )
  if ($RefreshXml -or [string]::IsNullOrWhiteSpace($Xml)) {
    $Xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  }
  $node = Find-UiNodeFragment -Xml $Xml -Needles $Needles -ClickableOnly:$ClickableOnly
  if (-not $node) { return @{ ok = $false; xml = $Xml } }
  $tapped = Invoke-AdbTapFromBounds -Sdk $Sdk -Serial $Serial -BoundsFragment $node
  Start-Sleep -Milliseconds 500
  return @{ ok = [bool]$tapped; xml = $Xml; node = $node }
}

function Invoke-TapTab {
  param(
    $Sdk,
    [string]$Serial,
    [ValidateSet('home', 'treino', 'nutricao', 'coach', 'mais')]
    [string]$Tab
  )
  $needleMap = @{
    home = @('tab-home', 'tab_home', 'Home')
    treino = @('tab-treino', 'tab_treinos', 'Treino')
    nutricao = @('tab-nutricao', 'tab_nutricao', 'Nutri')
    coach = @('tab-conversa', 'tab_coach', 'Coach')
    mais = @('tab_mais', 'tab_more', 'tab-mais', 'Mais')
  }
  $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  $tap = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xml -Needles $needleMap[$Tab] -ClickableOnly
  if ($tap.ok) { return $true }

  $size = Get-EmulatorDisplaySize -Sdk $Sdk -Serial $Serial
  $tabY = [int]($size.Height * 0.92)
  $tabXMap = @{
    home = 0.10; treino = 0.30; nutricao = 0.50; coach = 0.70; mais = 0.90
  }
  $x = [int]($size.Width * $tabXMap[$Tab])
  Invoke-AdbTap -Sdk $Sdk -Serial $Serial -X $x -Y $tabY
  return $true
}

function Get-WaterLitersFromXml {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $null }
  foreach ($m in [regex]::Matches($Xml, 'text="([^"]*)"')) {
    $t = $m.Groups[1].Value
    if ($t -match '(\d+\.\d+)\s*/\s*(\d+\.\d+)\s*L') {
      return @{ current = [double]$Matches[1]; target = [double]$Matches[2]; display = $t }
    }
  }
  return $null
}

function Get-WorkoutSeriesProgressFromXml {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $null }
  $completed = $null
  $total = $null
  $display = $null
  $savedSets = Get-WorkoutSavedSetsCountFromXml -Xml $Xml
  foreach ($m in [regex]::Matches($Xml, 'text="([^"]*)"')) {
    $t = $m.Groups[1].Value
    if ($t -match '(\d+)\s*/\s*(\d+)\s*series') {
      $completed = [int]$Matches[1]
      $total = [int]$Matches[2]
      $display = $t
      break
    }
    if ($t -match 'Finalizar treino\s*\((\d+)\s*/\s*(\d+)\)') {
      $completed = [int]$Matches[1]
      $total = [int]$Matches[2]
      $display = $t
    }
  }
  if ($null -ne $savedSets -and $null -ne $total) {
    $completed = [int]$savedSets
    $display = "$savedSets/$total series"
  }
  if ($null -eq $completed -or $null -eq $total) { return $null }
  return @{
    completed = $completed
    total = $total
    display = if ($display) { $display } else { "$completed/$total series" }
  }
}

function Get-WorkoutSavedSetsCountFromXml {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return $null }
  if ($Xml -match 'Series salvas:\s*(\d+)') { return [int]$Matches[1] }
  foreach ($m in [regex]::Matches($Xml, 'text="Series salvas:\s*(\d+)"')) {
    return [int]$m.Groups[1].Value
  }
  return $null
}

function Compare-WorkoutProgressIncreased {
  param($Before, $After, [int]$MinDelta = 1)
  if (-not $Before -or -not $After) { return $false }
  if ($After.completed -gt $Before.completed) { return $true }
  if ($After.completed -eq $Before.completed -and $After.total -eq $Before.total) { return $false }
  return ($After.completed -ge ($Before.completed + $MinDelta))
}

function Test-WorkoutCounterBug {
  param($Progress)
  if (-not $Progress) { return $false }
  if ($Progress.completed -gt $Progress.total) { return $true }
  if ($Progress.total -gt 0 -and $Progress.completed -gt ($Progress.total + 1)) { return $true }
  return $false
}

function Get-WorkoutScreenStateFromXml {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) {
    return @{
      onWorkoutScreen = $false
      exercisesVisible = $false
      setControlsVisible = $false
      finishButtonVisible = $false
      restTimerVisible = $false
      savedSetIndicator = $false
      addSetVisible = $false
    }
  }
  return @{
    onWorkoutScreen = Test-UiXmlHasNeedle -Xml $Xml -Needles @('screen-workout', 'Treino de hoje')
    exercisesVisible = Test-UiXmlHasNeedle -Xml $Xml -Needles @('Supino', 'exerc', 'input-novo-exercicio', 'btn-adicionar-exercicio')
    setControlsVisible = Test-UiXmlHasNeedle -Xml $Xml -Needles @('btn-save-set', 'input-weight', 'input-reps')
    finishButtonVisible = Test-UiXmlHasNeedle -Xml $Xml -Needles @('btn-finalizar-treino', 'Finalizar treino')
    restTimerVisible = Test-UiXmlHasNeedle -Xml $Xml -Needles @('rest-timer-floating', 'Descanso')
    savedSetIndicator = Test-UiXmlHasNeedle -Xml $Xml -Needles @('serie-salva-indicator', 'series-salvas-total', 'Series salvas')
    addSetVisible = Test-UiXmlHasNeedle -Xml $Xml -Needles @('btn-add-set', '+ Serie')
  }
}

function Find-WorkoutSaveSetNodes {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return @() }
  $nodes = [regex]::Matches($Xml, '<node[^>]+/?>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($m in $nodes) {
    $node = $m.Value
    if ($node -match 'btn-save-set' -and $node -match 'clickable="true"' -and $node -match 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
      [void]$out.Add($node)
    }
  }
  return @($out)
}

function Invoke-TapWorkoutSaveSetByIndex {
  param(
    $Sdk,
    [string]$Serial,
    [string]$Xml,
    [int]$Index = -1
  )
  $nodes = Find-WorkoutSaveSetNodes -Xml $Xml
  if (-not $nodes -or $nodes.Count -eq 0) { return @{ ok = $false; xml = $Xml; count = 0 } }
  $pick = if ($Index -ge 0 -and $Index -lt $nodes.Count) { $nodes[$Index] } else { $nodes[$nodes.Count - 1] }
  $tapped = Invoke-AdbTapFromBounds -Sdk $Sdk -Serial $Serial -BoundsFragment $pick
  Start-Sleep -Milliseconds 700
  return @{ ok = [bool]$tapped; xml = $Xml; count = $nodes.Count; node = $pick }
}

function Get-ExerciseNameFromXml {
  param([string]$Xml)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return '' }
  $skip = @('Treino de hoje', 'series', 'Finalizar', 'Descanso', 'Modo', 'Streak', 'Salvar', 'Serie', 'Peso', 'Reps')
  foreach ($m in [regex]::Matches($Xml, 'text="([^"]{3,80})"')) {
    $t = $m.Groups[1].Value.Trim()
    if ($t -match '^\d+/\d+' -or $t -match 'series$') { continue }
    $bad = $false
    foreach ($s in $skip) { if ($t -like "*$s*") { $bad = $true; break } }
    if (-not $bad -and $t.Length -gt 4) { return $t }
  }
  if ($Xml -match 'Supino|Agachamento|Remada|Rosca|Leg Press') {
    $hit = [regex]::Match($Xml, '(Supino[^"]*|Agachamento[^"]*|Remada[^"]*)')
    if ($hit.Success) { return $hit.Groups[1].Value }
  }
  return ''
}

function Test-NewSessionIsFresh {
  param($Progress)
  if (-not $Progress) { return $false }
  if ($Progress.total -le 0) { return $true }
  return ($Progress.completed -lt $Progress.total)
}

function Test-OverLimitAfterExtraSave {
  param($Before, $After, [string]$LogText = '')
  $bug = Test-WorkoutCounterBug -Progress $After
  if ($bug) {
    return @{
      overLimitBlocked = $false
      counterBugDetected = $true
      counterAfterExtraAttempt = if ($After) { $After.display } else { 'unknown' }
      verdictOverLimit = 'FAIL'
      setLoggedOnExtra = ($LogText -match 'set_logged')
      overLimitLog = ($LogText -match 'workout_set_over_limit')
    }
  }
  $unchanged = $false
  if ($Before -and $After) {
    $unchanged = ($Before.completed -eq $After.completed) -and ($Before.total -eq $After.total)
  }
  $overLog = ($LogText -match 'workout_set_over_limit')
  $noSetLogged = -not ($LogText -match 'set_logged')
  $toastLimit = ($LogText -match 'Limite de') -or ($LogText -match 'atingido')
  $blocked = ($unchanged -and $noSetLogged) -or $overLog -or $toastLimit
  $verdict = if ($blocked) { 'PASS' } elseif (-not $unchanged) { 'FAIL' } else { 'PARTIAL' }
  return @{
    overLimitBlocked = [bool]$blocked
    counterBugDetected = $false
    counterAfterExtraAttempt = if ($After) { $After.display } else { 'unknown' }
    verdictOverLimit = $verdict
    setLoggedOnExtra = -not $noSetLogged
    overLimitLog = [bool]$overLog
  }
}

function Invoke-DismissPaywallIfPresent {
  param($Sdk, [string]$Serial)
  $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  if ($xml -notmatch 'screen-paywall|EVOLUCAO PRO|Continuar no plano gratis') {
    return @{ dismissed = $false; xml = $xml }
  }
  if ($xml -match 'screen-paywall|EVOLUCAO PRO') {
    adb -s $Serial shell input swipe 540 1800 540 500 280 2>$null | Out-Null
    Start-Sleep -Seconds 1
    $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  }
  $tap = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xml -Needles @(
    'btn-paywall-dismiss', 'Continuar no plano gratis', 'btn-back', 'Voltar'
  ) -ClickableOnly
  if (-not $tap.ok) {
    adb -s $Serial shell input swipe 540 1800 540 400 280 2>$null | Out-Null
    Start-Sleep -Seconds 1
    $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
    $tap = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xml -Needles @(
      'btn-paywall-dismiss', 'Continuar no plano gratis', 'btn-back', 'Voltar'
    ) -ClickableOnly
  }
  Start-Sleep -Seconds 2
  $after = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  return @{ dismissed = [bool]$tap.ok; xml = $after }
}

function Test-EvolucaoAppForeground {
  param([string]$Xml)
  return ($Xml -match 'com\.tipolt\.evolucaofullv2')
}

function Invoke-EnsureEvolucaoForeground {
  param($Sdk, [string]$Serial, [int]$MaxAttempts = 5)
  for ($i = 0; $i -lt $MaxAttempts; $i++) {
    $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
    if (Test-EvolucaoAppForeground -Xml $xml) {
      Invoke-DismissPaywallIfPresent -Sdk $Sdk -Serial $Serial | Out-Null
      $after = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
      return @{ ok = $true; xml = $after }
    }
    if (Test-AndroidOverlayPresent -Xml $xml) {
      Invoke-DismissAndroidOverlay -Sdk $Sdk -Serial $Serial -Xml $xml | Out-Null
    } else {
      Invoke-AdbBack -Sdk $Sdk -Serial $Serial -Times 1 | Out-Null
      Start-Sleep -Milliseconds 500
      adb -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
      Start-Sleep -Seconds 3
      adb -s $Serial shell input keyevent KEYCODE_ESCAPE 2>$null | Out-Null
    }
    Start-Sleep -Seconds 1
  }
  $final = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  return @{ ok = (Test-EvolucaoAppForeground -Xml $final); xml = $final }
}

function Invoke-ReturnToMainTabs {
  param($Sdk, [string]$Serial, [int]$MaxBack = 6)
  for ($i = 0; $i -lt $MaxBack; $i++) {
    $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
    if (Test-UiXmlHasNeedle -Xml $xml -Needles @('tab_home', 'tab-home', 'tab_treinos', 'tab-treino', 'screen_home', 'screen-home', 'screen_treinos')) {
      return @{ ok = $true; xml = $xml }
    }
    if ($xml -match 'screen-paywall|EVOLUCAO PRO') {
      Invoke-DismissPaywallIfPresent -Sdk $Sdk -Serial $Serial | Out-Null
      Start-Sleep -Seconds 2
      continue
    }
    $tap = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xml -Needles @('btn-back', 'Voltar', 'Fechar') -ClickableOnly
    if (-not $tap.ok) {
      Invoke-AdbBack -Sdk $Sdk -Serial $Serial -Times 1 | Out-Null
    }
    Start-Sleep -Seconds 2
  }
  $final = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  return @{
    ok = (Test-UiXmlHasNeedle -Xml $final -Needles @('tab_home', 'tab-home', 'tab_treinos', 'tab-treino', 'screen_home', 'screen-home'))
    xml = $final
  }
}

function Invoke-OpenWorkoutScreen {
  param($Sdk, [string]$Serial)
  $openPath = 'none'

  Invoke-EnsureEvolucaoForeground -Sdk $Sdk -Serial $Serial | Out-Null
  Invoke-ReturnToMainTabs -Sdk $Sdk -Serial $Serial | Out-Null
  Invoke-TapTab -Sdk $Sdk -Serial $Serial -Tab treino | Out-Null
  Start-Sleep -Seconds 2
  Invoke-EnsureEvolucaoForeground -Sdk $Sdk -Serial $Serial | Out-Null
  Invoke-DismissPaywallIfPresent -Sdk $Sdk -Serial $Serial | Out-Null
  $hubXml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  $tapStart = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $hubXml -Needles @('btn_start_workout', 'btn-iniciar-treino', 'Iniciar treino', 'Treino recomendado') -ClickableOnly
  if ($tapStart.ok) {
    $openPath = 'hub_iniciar_treino'
    Start-Sleep -Seconds 2
    Invoke-DismissPaywallIfPresent -Sdk $Sdk -Serial $Serial | Out-Null
    $wait = Wait-UiNeedle -Sdk $Sdk -Serial $Serial -Needles @('screen-workout', 'Treino de hoje', 'btn-back', 'workout-exercise-progress') -TimeoutSec 28
    if ($wait.ok) { return @{ ok = $true; path = $openPath; xml = $wait.xml } }
  }

  Invoke-TapTab -Sdk $Sdk -Serial $Serial -Tab home | Out-Null
  Start-Sleep -Seconds 2
  $homeXml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  $tapContinue = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $homeXml -Needles @('CONTINUAR TREINO', 'Continuar treino', 'btn_home_main_cta') -ClickableOnly
  if ($tapContinue.ok) {
    $openPath = 'home_continuar_treino'
    Start-Sleep -Seconds 2
    Invoke-DismissPaywallIfPresent -Sdk $Sdk -Serial $Serial | Out-Null
    $wait = Wait-UiNeedle -Sdk $Sdk -Serial $Serial -Needles @('screen-workout', 'Treino de hoje', 'btn-back', 'workout-exercise-progress') -TimeoutSec 28
    if ($wait.ok) { return @{ ok = $true; path = $openPath; xml = $wait.xml } }
  }

  Invoke-TapTab -Sdk $Sdk -Serial $Serial -Tab treino | Out-Null
  Start-Sleep -Seconds 2
  $hubXml2 = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  $tapFree = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $hubXml2 -Needles @('Treino Livre', 'TreinoLivre', 'treino livre') -ClickableOnly
  if ($tapFree.ok) {
    $openPath = 'hub_treino_livre'
    $wait = Wait-UiNeedle -Sdk $Sdk -Serial $Serial -Needles @('screen-workout', 'Treino de hoje', 'Treino livre', 'btn-back') -TimeoutSec 22
    if ($wait.ok) { return @{ ok = $true; path = $openPath; xml = $wait.xml } }
  }

  return @{ ok = $false; path = $openPath; xml = (Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial) }
}

function Get-UiTextSamples {
  param([string]$Xml, [int]$Limit = 25)
  if ([string]::IsNullOrWhiteSpace($Xml)) { return @() }
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($m in [regex]::Matches($Xml, 'text="([^"]{2,120})"')) {
    $v = $m.Groups[1].Value.Trim()
    if ($v -and $out -notcontains $v) { [void]$out.Add($v) }
    if ($out.Count -ge $Limit) { break }
  }
  return @($out)
}

function Invoke-AdbInputText {
  param($Sdk, [string]$Serial, [string]$Text)
  $safe = ($Text -replace '\s', '%s')
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell input text $safe 2>nul" | Out-Null
  Start-Sleep -Milliseconds 400
}

function Fill-WorkoutSetViaKeypad {
  param(
    $Sdk,
    [string]$Serial,
    [string]$FieldNeedle = 'input-weight',
    [string]$Value = '10'
  )
  $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xml -Needles @($FieldNeedle) -ClickableOnly | Out-Null
  Start-Sleep -Milliseconds 600
  foreach ($ch in $Value.ToCharArray()) {
    $digitId = if ($ch -eq '.') { 'keypad-digit-dot' } else { "keypad-digit-$ch" }
    $xmlK = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
    $tap = Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xmlK -Needles @($digitId, [string]$ch) -ClickableOnly
    if (-not $tap.ok) {
      Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xmlK -Needles @([string]$ch) -ClickableOnly | Out-Null
    }
    Start-Sleep -Milliseconds 250
  }
  $xmlOk = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xmlOk -Needles @('keypad-confirm', 'OK') -ClickableOnly | Out-Null
  Start-Sleep -Milliseconds 500
  return @{ ok = $true; field = $FieldNeedle; value = $Value }
}

function Test-UiHasBackButton {
  param([string]$Xml)
  return (Test-UiXmlHasNeedle -Xml $Xml -Needles @('btn-back', 'Voltar', 'Fechar', 'chevron-back'))
}

function Invoke-AdbBack {
  param($Sdk, [string]$Serial, [int]$Times = 1)
  for ($i = 0; $i -lt $Times; $i++) {
    cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell input keyevent 4 2>nul" | Out-Null
    Start-Sleep -Milliseconds 450
  }
}

function Wait-UiNeedle {
  param(
    $Sdk,
    [string]$Serial,
    [string[]]$Needles,
    [int]$TimeoutSec = 12
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
    if (Test-UiXmlHasNeedle -Xml $xml -Needles $Needles) {
      return @{ ok = $true; xml = $xml }
    }
    Start-Sleep -Milliseconds 700
  }
  return @{ ok = $false; xml = (Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial) }
}

function Test-EntryGateState {
  param(
    [string]$Xml,
    [string]$LogText = '',
    [switch]$QaVisualSessionExpected
  )
  $signals = Get-UiVisibleSignals -Xml $Xml
  $haystack = ($Xml + ' ' + ($signals.texts -join ' ') + ' ' + ($signals.testIds -join ' '))

  $reachedMainTabs = Test-UiXmlHasNeedle -Xml $Xml -Needles $script:MainTabsNeedles
  $onLogin = Test-UiXmlHasNeedle -Xml $Xml -Needles $script:LoginScreenNeedles
  $onOverlay = Test-UiXmlHasNeedle -Xml $Xml -Needles $script:OverlayNeedles
  $onLoading = ($Xml -match 'screen_loading') -and (-not $reachedMainTabs)

  $authStateSignal = 'none'
  if ($LogText -match 'qa-nav-audit|QA Nav Audit') {
    $authStateSignal = 'qa_visual_seed'
  } elseif ($LogText -match 'FirebaseAuth|currentUser|signed in') {
    $authStateSignal = 'firebase_user'
  } elseif ($LogText -match '\[AUTH\]|android_native_id_token') {
    $authStateSignal = 'logcat_only'
  }

  $blockedBy = 'unknown'
  if ($reachedMainTabs) {
    $blockedBy = 'none'
  } elseif ($onOverlay) {
    $blockedBy = 'overlay'
  } elseif ($onLogin) {
    $blockedBy = 'login'
  } elseif ($onLoading) {
    $blockedBy = 'loading'
  } elseif ($haystack -match 'Firebase|auth/|network-request-failed') {
    $blockedBy = 'firebase'
  } elseif ($haystack -match 'API ERROR|Render|502|503|ECONNREFUSED') {
    $blockedBy = 'backend'
  }

  $verdict = if ($reachedMainTabs) { 'ENTRY_GATE_PASS' } else { 'ENTRY_GATE_FAIL' }
  return @{
    reachedMainTabs = [bool]$reachedMainTabs
    blockedBy = $blockedBy
    visibleTexts = @($signals.texts | Select-Object -First 40)
    visibleTestIds = @($signals.testIds | Select-Object -First 40)
    authStateSignal = $authStateSignal
    qaVisualSessionExpected = [bool]$QaVisualSessionExpected
    verdict = $verdict
  }
}

function Save-EntryGateArtifacts {
  param(
    $Sdk,
    [string]$Serial,
    [string]$OutDir,
    [int]$WaitSec = 10,
    [string]$LogPattern = 'AUTH|GOOGLE|Firebase|FATAL|ReactNativeJS|API|CONFIGURED|qa-nav-audit|VISUAL_SESSION',
    [switch]$QaVisualSessionExpected,
    [switch]$DismissOverlays
  )
  if (-not $PSBoundParameters.ContainsKey('DismissOverlays')) {
    $DismissOverlays = $true
  }

  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  Start-Sleep -Seconds $WaitSec

  $shotPath = Join-Path $OutDir '00_entry_screenshot.png'
  $xmlPath = Join-Path $OutDir '00_entry_ui.xml'
  $logPath = Join-Path $OutDir '00_entry_logcat.txt'

  $overlayDetected = $false
  $overlayDismissed = $false
  $overlayType = $null
  $preOverlayShot = $null
  $preOverlayXml = $null
  $postOverlayShot = $null
  $postOverlayXml = $null

  $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  if ($DismissOverlays -and (Test-AndroidOverlayPresent -Xml $xml)) {
    $overlayDetected = $true
    $overlayType = Get-OverlayType -Xml $xml
    $preOverlayShot = Join-Path $OutDir '00_entry_pre_overlay_screenshot.png'
    $preOverlayXml = Join-Path $OutDir '00_entry_pre_overlay_ui.xml'
    Save-EmulatorScreenshot -Sdk $Sdk -Serial $Serial -OutPath $preOverlayShot | Out-Null
    $xml | Set-Content -Path $preOverlayXml -Encoding UTF8

    $dismissed = Invoke-DismissAndroidOverlay -Sdk $Sdk -Serial $Serial -Xml $xml
    Start-Sleep -Seconds 2
    $xmlAfter = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
    $overlayDismissed = $dismissed -and (-not (Test-AndroidOverlayPresent -Xml $xmlAfter))
    if (-not $overlayDismissed -and $dismissed) {
      $overlayDismissed = $true
    }
    $postOverlayShot = Join-Path $OutDir '00_entry_post_overlay_screenshot.png'
    $postOverlayXml = Join-Path $OutDir '00_entry_post_overlay_ui.xml'
    Save-EmulatorScreenshot -Sdk $Sdk -Serial $Serial -OutPath $postOverlayShot | Out-Null
    $xmlAfter | Set-Content -Path $postOverlayXml -Encoding UTF8
    $xml = $xmlAfter
  }

  Save-EmulatorScreenshot -Sdk $Sdk -Serial $Serial -OutPath $shotPath | Out-Null
  $xml | Set-Content -Path $xmlPath -Encoding UTF8
  $logText = Get-LogcatSnapshot -Sdk $Sdk -Serial $Serial -Pattern $LogPattern -TailLines 600
  $logText | Set-Content -Path $logPath -Encoding UTF8

  $state = Test-EntryGateState -Xml $xml -LogText $logText -QaVisualSessionExpected:$QaVisualSessionExpected
  $summary = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    reachedMainTabs = $state.reachedMainTabs
    blockedBy = $state.blockedBy
    overlayDetected = [bool]$overlayDetected
    overlayDismissed = [bool]$overlayDismissed
    overlayType = $overlayType
    visibleTexts = $state.visibleTexts
    visibleTestIds = $state.visibleTestIds
    authStateSignal = $state.authStateSignal
    qaVisualSessionExpected = $state.qaVisualSessionExpected
    verdict = $state.verdict
    screenshot = $shotPath
    uiXml = $xmlPath
    logcat = $logPath
    preOverlayScreenshot = $preOverlayShot
    preOverlayUiXml = $preOverlayXml
    postOverlayScreenshot = $postOverlayShot
    postOverlayUiXml = $postOverlayXml
  }
  $jsonPath = Join-Path $OutDir 'entry_gate_summary.json'
  $summary | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8
  return $summary
}

function Test-TreinoHubVisible {
  param([string]$Xml)
  return (Test-UiXmlHasNeedle -Xml $Xml -Needles @(
    'screen_treinos', 'Treinos', 'btn_start_workout', 'btn-iniciar-treino',
    'tab_treinos', 'tab-treino', 'Treino Livre', 'Rotinas', 'Import IA', 'Historico'
  ))
}

function Test-RestPresetsVisible {
  param([string]$Xml)
  $hasLabel = ($Xml -match 'text-rest-preset-active|Descanso:\s*\d+s')
  $hasPreset = ($Xml -match 'btn-rest-preset-30|btn-rest-preset-60|btn-rest-preset-120')
  return @{
    ok = [bool]($hasLabel -and $hasPreset)
    hasLabel = [bool]$hasLabel
    hasPreset = [bool]$hasPreset
  }
}

function Test-ExerciseProgressLabel {
  param([string]$Xml, [int]$ExpectedTotal = 0)
  $hasProgress = ($Xml -match 'workout-exercise-progress|Exercicio\s+\d+\s+de\s+\d+')
  $match = [regex]::Match($Xml, 'Exercicio\s+(\d+)\s+de\s+(\d+)')
  $current = if ($match.Success) { [int]$match.Groups[1].Value } else { 0 }
  $total = if ($match.Success) { [int]$match.Groups[2].Value } else { 0 }
  $totalOk = ($ExpectedTotal -le 0) -or ($total -eq $ExpectedTotal)
  return @{
    ok = [bool]($hasProgress -and $total -ge 1)
    current = $current
    total = $total
    hasProgress = [bool]$hasProgress
    multiExercise = [bool]($total -gt 1)
  }
}

function Test-MultiExerciseVisibility {
  param([string]$Xml, [switch]$AdvancedMode)
  $progress = Test-ExerciseProgressLabel -Xml $Xml
  $hasNext = ($Xml -match 'workout-next-exercise-card|Proximo:')
  $hasAdvancedList = ($Xml -match 'workout-exercise-list-advanced|workout-exercise-index-')
  return @{
    ok = if ($AdvancedMode) {
      [bool]($progress.hasProgress -and ($progress.multiExercise -eq $false -or $hasAdvancedList))
    } else {
      [bool]($progress.hasProgress -and ($progress.multiExercise -eq $false -or $hasNext))
    }
    progress = $progress
    hasNext = [bool]$hasNext
    hasAdvancedList = [bool]$hasAdvancedList
  }
}

function Invoke-QaWorkoutReset {
  param($Sdk, [string]$Serial)
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell am start -a android.intent.action.VIEW -d `"evolucao://qa/workout-reset`" com.tipolt.evolucaofullv2 2>nul" | Out-Null
  Start-Sleep -Seconds 2
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell am force-stop com.tipolt.evolucaofullv2 2>nul" | Out-Null
  Start-Sleep -Seconds 1
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell monkey -p com.tipolt.evolucaofullv2 -c android.intent.category.LAUNCHER 1 2>nul" | Out-Null
  Start-Sleep -Seconds 22
  cmd.exe /c "`"$($Sdk.Adb)`" -s $Serial shell input keyevent KEYCODE_ESCAPE 2>nul" | Out-Null
  Start-Sleep -Seconds 2
}

function Get-WorkoutUiMetrics {
  param([string]$Xml, [int]$ExpectedExerciseTotal = 5)
  $progress = Test-ExerciseProgressLabel -Xml $Xml -ExpectedTotal $ExpectedExerciseTotal
  $pctMatch = [regex]::Match($Xml, 'Treino:\s*(\d+)%\s*concluid')
  $pctAlt = [regex]::Match($Xml, '(\d+)%\s*concluid')
  $pct = if ($pctMatch.Success) { [int]$pctMatch.Groups[1].Value } elseif ($pctAlt.Success) { [int]$pctAlt.Groups[1].Value } else { -1 }
  $seriesMatch = [regex]::Match($Xml, '(\d+)/(\d+)\s+series')
  $seriesDone = if ($seriesMatch.Success) { [int]$seriesMatch.Groups[1].Value } else { 0 }
  $seriesTotal = if ($seriesMatch.Success) { [int]$seriesMatch.Groups[2].Value } else { 0 }
  $rest = Test-RestPresetsVisible -Xml $Xml
  return @{
    exerciseCurrent = $progress.current
    exerciseTotal = $progress.total
    exerciseTotalOk = ($ExpectedExerciseTotal -le 0) -or ($progress.total -eq $ExpectedExerciseTotal)
    progressPct = $pct
    seriesDone = $seriesDone
    seriesTotal = $seriesTotal
    restPresetsOk = [bool]$rest.ok
    finishVisible = [bool]($Xml -match 'Finalizar treino')
    simpleMode = [bool]($Xml -match 'Modo simples ativo|workout-exercise-list-simple')
    advancedMode = [bool]($Xml -match 'Modo avancado ativo|workout-exercise-list-advanced')
  }
}

function Invoke-SaveOneWorkoutSet {
  param(
    $Sdk,
    [string]$Serial,
    [string]$Weight = '60',
    [string]$Reps = '10'
  )
  Fill-WorkoutSetViaKeypad -Sdk $Sdk -Serial $Serial -FieldNeedle 'input-weight' -Value $Weight | Out-Null
  Fill-WorkoutSetViaKeypad -Sdk $Sdk -Serial $Serial -FieldNeedle 'input-reps' -Value $Reps | Out-Null
  $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xml -Needles @('btn-save-set') -ClickableOnly | Out-Null
  Start-Sleep -Seconds 2
}

function Invoke-ToggleWorkoutMode {
  param($Sdk, [string]$Serial)
  $xml = Get-UiXmlSnapshot -Sdk $Sdk -Serial $Serial
  Invoke-TapUiNeedle -Sdk $Sdk -Serial $Serial -Xml $xml -Needles @('btn-toggle-workout-mode', 'Modo simples ativo', 'Modo avancado ativo') -ClickableOnly | Out-Null
  Start-Sleep -Seconds 2
}

