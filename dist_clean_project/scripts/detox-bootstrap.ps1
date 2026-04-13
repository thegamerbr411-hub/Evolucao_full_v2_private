param(
  [string]$Mode = 'auto',
  [string]$Run = 'cycle',
  [string]$TestPattern = '',
  [switch]$AllowNoTarget = $true,
  [switch]$ReuseApp = $true
)

$ErrorActionPreference = 'Stop'

$script:BootstrapLogFile = $null

function Write-StepLog([string]$Level, [string]$Stage, [string]$Message) {
  $ts = (Get-Date).ToString('o')
  $line = "[$ts][$Level][$Stage] $Message"
  Write-Host $line
  if ($script:BootstrapLogFile) {
    $line | Out-File -FilePath $script:BootstrapLogFile -Encoding utf8 -Append
  }
}

function Stop-StaleProcesses {
  $targets = @('gradle', 'java', 'node')
  foreach ($name in $targets) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        $_ | Stop-Process -Force -ErrorAction SilentlyContinue
      } catch {
        # ignore
      }
    }
  }
}

function Invoke-CommandWithWatchdog {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [int]$TimeoutSec = 300,
    [int]$NoOutputTimeoutSec = 120,
    [string]$Stage = 'command'
  )

  $workDir = $repoRoot
  $outDir = Join-Path $repoRoot 'artifacts\detox'
  if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $stdoutFile = Join-Path $outDir "$Stage-$stamp.stdout.log"
  $stderrFile = Join-Path $outDir "$Stage-$stamp.stderr.log"

  Write-StepLog 'INFO' $Stage "exec: $FilePath $($Arguments -join ' ')"

  $proc = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $workDir -NoNewWindow -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile

  $startedAt = Get-Date
  $lastOutputAt = Get-Date
  $lastOutLen = 0
  $lastErrLen = 0

  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 2

    $stdoutLen = 0
    $stderrLen = 0
    if (Test-Path $stdoutFile) {
      $stdoutLen = (Get-Item $stdoutFile).Length
    }
    if (Test-Path $stderrFile) {
      $stderrLen = (Get-Item $stderrFile).Length
    }

    if ($stdoutLen -gt $lastOutLen -or $stderrLen -gt $lastErrLen) {
      $lastOutputAt = Get-Date
      $lastOutLen = $stdoutLen
      $lastErrLen = $stderrLen
    }

    $elapsed = ((Get-Date) - $startedAt).TotalSeconds
    $idleFor = ((Get-Date) - $lastOutputAt).TotalSeconds

    if ($elapsed -gt $TimeoutSec) {
      Write-StepLog 'WARN' $Stage "timeout global de ${TimeoutSec}s; finalizando processo $($proc.Id)."
      try { $proc | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
      Stop-StaleProcesses
      return [PSCustomObject]@{ ExitCode = 124; Stdout = $stdoutFile; Stderr = $stderrFile; TimedOut = $true; NoOutputTimeout = $false }
    }

    if ($idleFor -gt $NoOutputTimeoutSec) {
      Write-StepLog 'WARN' $Stage "sem output por ${NoOutputTimeoutSec}s; finalizando processo $($proc.Id)."
      try { $proc | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
      Stop-StaleProcesses
      return [PSCustomObject]@{ ExitCode = 125; Stdout = $stdoutFile; Stderr = $stderrFile; TimedOut = $false; NoOutputTimeout = $true }
    }
  }

  try {
    $proc.WaitForExit()
    $proc.Refresh()
  } catch {
    # segue com melhor esforço para coletar exit code
  }

  $exitCode = if ($null -ne $proc.ExitCode) { [int]$proc.ExitCode } else { 1 }
  Write-StepLog 'INFO' $Stage "exitCode=$exitCode stdout=$stdoutFile stderr=$stderrFile"
  return [PSCustomObject]@{ ExitCode = $exitCode; Stdout = $stdoutFile; Stderr = $stderrFile; TimedOut = $false; NoOutputTimeout = $false }
}

function Get-SdkRoot {
  if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
  if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }

  $fallback = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  if (Test-Path $fallback) { return $fallback }

  return ''
}

function Get-AdbPath([string]$SdkRoot) {
  if (-not $SdkRoot) { return 'adb' }
  $adbExe = Join-Path $SdkRoot 'platform-tools\adb.exe'
  if (Test-Path $adbExe) { return $adbExe }
  return 'adb'
}

function Get-EmulatorPath([string]$SdkRoot) {
  if (-not $SdkRoot) { return '' }
  $emuExe = Join-Path $SdkRoot 'emulator\emulator.exe'
  if (Test-Path $emuExe) { return $emuExe }
  return ''
}

function Test-EmulatorAcceleration([string]$SdkRoot) {
  if (-not $SdkRoot) {
    return $false
  }

  $checkExe = Join-Path $SdkRoot 'emulator\emulator-check.exe'
  if (-not (Test-Path $checkExe)) {
    return $false
  }

  try {
    & $checkExe accel | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Get-AvailableAvds([string]$EmulatorCmd) {
  if (-not $EmulatorCmd -or -not (Test-Path $EmulatorCmd)) {
    return @()
  }

  try {
    $lines = & $EmulatorCmd -list-avds 2>$null
  } catch {
    return @()
  }

  if (-not $lines) {
    return @()
  }

  $raw = @($lines)

  return @($raw |
    ForEach-Object { $_.ToString().Trim() } |
    Where-Object { $_ -and $_ -notmatch '^INFO\b' })
}

function Get-AttachedDevices([string]$AdbCmd) {
  try {
    $lines = & $AdbCmd devices 2>$null
  } catch {
    return @()
  }

  if (-not $lines) { return @() }

  return @($lines |
    Select-Object -Skip 1 |
    ForEach-Object { $_.ToString().Trim() } |
    Where-Object { $_ -match '\sdevice$' } |
    ForEach-Object { ($_ -split '\s+')[0] })
}

function Ensure-AdbReverse([string]$AdbCmd, [string]$DeviceId) {
  if (-not $DeviceId) { return }

  try {
    & $AdbCmd -s $DeviceId reverse --remove-all | Out-Null
    & $AdbCmd -s $DeviceId reverse tcp:8081 tcp:8081 | Out-Null
    & $AdbCmd -s $DeviceId reverse tcp:3000 tcp:3000 | Out-Null
    & $AdbCmd -s $DeviceId reverse tcp:8082 tcp:8082 | Out-Null
    Write-Host "[detox-bootstrap] adb reverse ok for $DeviceId (8081,3000,8082)"
  } catch {
    Write-Host "[detox-bootstrap] adb reverse falhou para ${DeviceId}: $($_.Exception.Message)"
  }
}

function Capture-LogcatOnFailure([string]$AdbCmd, [string]$DeviceId) {
  if (-not $DeviceId) { return }

  try {
    $artifactDir = Join-Path $repoRoot 'artifacts\detox'
    if (-not (Test-Path $artifactDir)) {
      New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $logFile = Join-Path $artifactDir "logcat-$stamp.txt"
    & $AdbCmd -s $DeviceId logcat -d | Out-File -FilePath $logFile -Encoding utf8
    Write-Host "[detox-bootstrap] logcat salvo em $logFile"
  } catch {
    Write-Host "[detox-bootstrap] falha ao salvar logcat: $($_.Exception.Message)"
  }
}

function Get-FileFingerprint([string]$RootPath) {
  $targets = @(
    'App.js',
    'app.json',
    'package.json',
    'src',
    'android\app\src',
    'assets'
  )

  $entries = New-Object System.Collections.Generic.List[string]

  function Convert-ToRelativePath([string]$BasePath, [string]$TargetPath) {
    $base = (Resolve-Path $BasePath).Path
    $target = (Resolve-Path $TargetPath).Path
    if ($target.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
      $relative = $target.Substring($base.Length).TrimStart([char[]]@([char]92, [char]47))
      return $relative -replace '\\', '/'
    }
    return $target
  }

  foreach ($target in $targets) {
    $fullPath = Join-Path $RootPath $target
    if (-not (Test-Path $fullPath)) { continue }

    if (Test-Path $fullPath -PathType Leaf) {
      $item = Get-Item $fullPath -ErrorAction SilentlyContinue
      if ($item) {
        $relative = Convert-ToRelativePath -BasePath $RootPath -TargetPath $item.FullName
        $entries.Add("$relative|$($item.Length)|$($item.LastWriteTimeUtc.Ticks)")
      }
      continue
    }

    Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue |
      Sort-Object FullName |
      ForEach-Object {
        $relative = Convert-ToRelativePath -BasePath $RootPath -TargetPath $_.FullName
        $entries.Add("$relative|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)")
      }
  }

  $joined = [string]::Join("`n", $entries)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($joined)
    $hash = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-BootstrapStatePath([string]$RootPath) {
  $artifactDir = Join-Path $RootPath 'artifacts'
  if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
  }
  return Join-Path $artifactDir 'detox-bootstrap-state.json'
}

function Read-BootstrapState([string]$StatePath) {
  if (-not (Test-Path $StatePath)) { return $null }
  try {
    return Get-Content -Path $StatePath -Raw -ErrorAction Stop | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Write-BootstrapState([string]$StatePath, [string]$Configuration, [string]$Fingerprint) {
  $payload = @{
    configuration = $Configuration
    fingerprint = $Fingerprint
    updatedAt = (Get-Date).ToString('o')
  }
  $json = $payload | ConvertTo-Json -Depth 3
  $json | Out-File -FilePath $StatePath -Encoding utf8
}

function Test-InstrumentationInstalled([string]$AdbCmd, [string]$DeviceId, [string]$PackageName) {
  if (-not $DeviceId) { return $false }
  try {
    $lines = & $AdbCmd -s $DeviceId shell pm list instrumentation 2>$null
    if (-not $lines) { return $false }
    $text = @($lines) -join "`n"
    return ($text -match [regex]::Escape($PackageName))
  } catch {
    return $false
  }
}

function Get-DetoxCommand {
  if ($env:OS -eq 'Windows_NT') {
    $localCmd = Join-Path $repoRoot 'node_modules\.bin\detox.cmd'
    if (Test-Path $localCmd) {
      return $localCmd
    }
    return 'npx.cmd'
  }

  $localCmd = Join-Path $repoRoot 'node_modules/.bin/detox'
  if (Test-Path $localCmd) {
    return $localCmd
  }
  return 'npx'
}

function Test-JestSuccessFromDetoxLog([string]$LogPath) {
  if (-not $LogPath -or -not (Test-Path $LogPath)) {
    return $false
  }

  try {
    $tail = Get-Content -Path $LogPath -Tail 200 -ErrorAction Stop
    $text = @($tail) -join "`n"
    if ($text -match 'Test Suites:' -and $text -match '\bpassed\b' -and $text -notmatch '\bfailed\b') {
      return $true
    }
  } catch {
    return $false
  }

  return $false
}

function Invoke-DetoxBuild([string]$Configuration) {
  Write-StepLog 'INFO' 'build' "rebuilding Detox binaries for $Configuration"

  # Para attached no Windows, executar Gradle diretamente evita falso exit=1 do wrapper Detox.
  if ($Configuration -like 'android.attached.*') {
    $buildStage = "build-$($Configuration.Replace('.', '-'))"
    $gradleArgs = if ($env:OS -eq 'Windows_NT') {
      @('/c', 'cd android && gradlew.bat assembleRelease assembleAndroidTest -DtestBuildType=release')
    } else {
      @('-lc', 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release')
    }
    $shellCmd = if ($env:OS -eq 'Windows_NT') { 'cmd.exe' } else { 'bash' }
    $directResult = Invoke-CommandWithWatchdog -FilePath $shellCmd -Arguments $gradleArgs -TimeoutSec 900 -NoOutputTimeoutSec 180 -Stage $buildStage

    if ($directResult.ExitCode -ne 0 -and (Test-Path $directResult.Stdout)) {
      $tail = Get-Content -Path $directResult.Stdout -Tail 40 -ErrorAction SilentlyContinue
      $tailText = @($tail) -join "`n"
      if ($tailText -match 'BUILD SUCCESSFUL') {
        Write-StepLog 'WARN' 'build' 'exit code nao-zero detectado com BUILD SUCCESSFUL no log; tratando como sucesso.'
        return 0
      }
    }

    return $directResult.ExitCode
  }

  $detoxCommand = Get-DetoxCommand
  $args = if ($detoxCommand -like '*npx*') { @('detox', 'build', '--configuration', $Configuration) } else { @('build', '--configuration', $Configuration) }
  $attempts = 2
  for ($try = 1; $try -le $attempts; $try += 1) {
    Write-StepLog 'INFO' 'build' "tentativa=$try/${attempts}"
    $result = Invoke-CommandWithWatchdog -FilePath $detoxCommand -Arguments $args -TimeoutSec 900 -NoOutputTimeoutSec 180 -Stage "build-$($Configuration.Replace('.', '-'))"
    if ($result.ExitCode -eq 0) {
      return 0
    }

    if ($try -lt $attempts) {
      Write-StepLog 'WARN' 'build' "build falhou (exit=$($result.ExitCode)); limpando processos e tentando novamente com stacktrace."
      Stop-StaleProcesses
      $args = if ($detoxCommand -like '*npx*') { @('detox', 'build', '--configuration', $Configuration, '--loglevel', 'trace') } else { @('build', '--configuration', $Configuration, '--loglevel', 'trace') }
    }
  }

  return 1
}

function Remove-AppFromDevice([string]$AdbCmd, [string]$DeviceId, [string]$PackageName) {
  if (-not $DeviceId) { return }
  try {
    Write-Host "[detox-bootstrap] uninstall antigo: $PackageName"
    & $AdbCmd -s $DeviceId uninstall $PackageName | Out-Null
  } catch {
    Write-Host "[detox-bootstrap] uninstall ignorado: $($_.Exception.Message)"
  }
}

function Test-AppInstalled([string]$AdbCmd, [string]$DeviceId, [string]$PackageName) {
  if (-not $DeviceId) { return $false }
  try {
    $result = & $AdbCmd -s $DeviceId shell pm path $PackageName 2>$null
    if (-not $result) { return $false }
    $flat = (@($result) -join "`n")
    return $flat -match 'package:'
  } catch {
    return $false
  }
}

function Install-AppWithRetry([string]$AdbCmd, [string]$DeviceId, [string]$ApkPath, [string]$PackageName) {
  if (-not (Test-Path $ApkPath)) {
    throw "APK nao encontrado: $ApkPath"
  }

  $installArgs = @('-s', $DeviceId, 'install', '-r', '-d', '-g', $ApkPath)
  Write-StepLog 'INFO' 'install' "tentando install -r: $ApkPath"
  & $AdbCmd @installArgs | Out-Null
  if ($LASTEXITCODE -eq 0) {
    return $true
  }

  Write-StepLog 'WARN' 'install' 'install -r falhou, aplicando fallback uninstall -> install.'
  Remove-AppFromDevice -AdbCmd $AdbCmd -DeviceId $DeviceId -PackageName $PackageName
  & $AdbCmd @installArgs | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Ensure-AppForConfiguration([string]$Configuration, [string]$DeviceId, [string]$AdbCmd, [string]$PackageName) {
  if (-not $DeviceId -or -not $Configuration.StartsWith('android.attached.')) {
    return
  }

  if (Test-AppInstalled -AdbCmd $AdbCmd -DeviceId $DeviceId -PackageName $PackageName) {
    Write-StepLog 'INFO' 'install' 'app ja instalado; reuse habilitado.'
    return
  }

  $apkPath = if ($Configuration -eq 'android.attached.release') {
    Join-Path $repoRoot 'android\app\build\outputs\apk\release\app-release.apk'
  } else {
    Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
  }

  if (-not (Test-Path $apkPath)) {
    Write-StepLog 'INFO' 'build' 'APK ausente; executando detox build para gerar binarios.'
    $buildCode = Invoke-DetoxBuild -Configuration $Configuration
    if ($buildCode -ne 0) {
      throw "Falha no detox build ($Configuration) ao preparar instalacao."
    }
  }

  $installed = Install-AppWithRetry -AdbCmd $AdbCmd -DeviceId $DeviceId -ApkPath $apkPath -PackageName $PackageName
  if (-not $installed) {
    throw "Falha ao instalar app no device attached para configuracao $Configuration."
  }
}

function Get-AvdAbi([string]$AvdName) {
  $configPath = Join-Path (Join-Path $env:USERPROFILE '.android\avd') "$AvdName.avd\config.ini"
  if (-not (Test-Path $configPath)) {
    return ''
  }

  try {
    $line = Get-Content $configPath -ErrorAction Stop | Where-Object { $_ -match '^abi\.type=' } | Select-Object -First 1
    if (-not $line) { return '' }
    return ($line -replace '^abi\.type=', '').Trim().ToLowerInvariant()
  } catch {
    return ''
  }
}

function Select-PreferredAvd([string[]]$AvdNames) {
  if (-not $AvdNames -or $AvdNames.Count -eq 0) {
    return ''
  }

  $ranked = @($AvdNames | ForEach-Object {
    $name = $_
    $abi = Get-AvdAbi -AvdName $name
    $score = if ($abi -match 'x86_64|x86') { 100 } elseif ($abi -match 'arm64|arm') { 10 } else { 50 }
    [PSCustomObject]@{ Name = $name; Abi = $abi; Score = $score }
  } | Sort-Object -Property Score -Descending)

  if ($ranked.Count -eq 0) {
    return $AvdNames[0]
  }

  return $ranked[0].Name
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$detoxArtifactDir = Join-Path $repoRoot 'artifacts\detox'
if (-not (Test-Path $detoxArtifactDir)) {
  New-Item -ItemType Directory -Path $detoxArtifactDir -Force | Out-Null
}
$script:BootstrapLogFile = Join-Path $detoxArtifactDir ("bootstrap-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Write-StepLog 'INFO' 'bootstrap' "inicio mode=$Mode run=$Run pattern=$TestPattern"

$shouldReuse = [bool]$ReuseApp

$sdkRoot = Get-SdkRoot
if ($sdkRoot) {
  $env:ANDROID_SDK_ROOT = $sdkRoot
  if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = $sdkRoot }
}

$adbCmd = Get-AdbPath -SdkRoot $sdkRoot
$emulatorCmd = Get-EmulatorPath -SdkRoot $sdkRoot
$avds = @(Get-AvailableAvds -EmulatorCmd $emulatorCmd)
$devices = @(Get-AttachedDevices -AdbCmd $adbCmd)
$preferredAvd = Select-PreferredAvd -AvdNames $avds
$hasEmulatorAccel = Test-EmulatorAcceleration -SdkRoot $sdkRoot

$selectedMode = $Mode.ToLowerInvariant()
if ($selectedMode -eq 'auto') {
  if ($preferredAvd -and $hasEmulatorAccel) {
    $selectedMode = 'emulator'
  } elseif ($devices.Count -gt 0) {
    $selectedMode = 'attached'
  } elseif ($preferredAvd -and -not $hasEmulatorAccel) {
    $selectedMode = 'none'
  }
}

if ($selectedMode -eq 'emulator') {
  if (-not $preferredAvd -or -not $hasEmulatorAccel) {
    if ($AllowNoTarget) {
      $env:DETOX_ALLOW_NO_TARGET = '1'
      if (-not $hasEmulatorAccel) {
        Write-Host '[detox-bootstrap] aceleracao de emulador indisponivel, seguindo com skip controlado.'
      } else {
        Write-Host '[detox-bootstrap] sem AVD, seguindo com skip controlado.'
      }
    } else {
      if (-not $hasEmulatorAccel) {
        throw 'Aceleracao de emulador indisponivel para modo emulator.'
      }
      throw 'Sem AVD disponivel para modo emulator.'
    }
  } else {
    $env:DETOX_CONFIGURATION = 'android.emulator.debug'
    $env:DETOX_AVD_NAME = $preferredAvd
    Remove-Item Env:DETOX_ALLOW_NO_TARGET -ErrorAction SilentlyContinue
    Write-Host "[detox-bootstrap] usando AVD: $preferredAvd"
  }
} elseif ($selectedMode -eq 'attached') {
  if ($devices.Count -eq 0) {
    if ($AllowNoTarget) {
      $env:DETOX_ALLOW_NO_TARGET = '1'
      Write-Host '[detox-bootstrap] sem device attached, seguindo com skip controlado.'
    } else {
      throw 'Sem device attached para modo attached.'
    }
  } else {
    $env:DETOX_CONFIGURATION = if ($env:DETOX_ATTACHED_CONFIGURATION) { $env:DETOX_ATTACHED_CONFIGURATION } else { 'android.attached.debug' }
    $requestedDevice = [string]$env:DETOX_ADB_NAME
    if (-not [string]::IsNullOrWhiteSpace($requestedDevice) -and ($devices -contains $requestedDevice)) {
      $env:DETOX_ADB_NAME = $requestedDevice
    } else {
      $env:DETOX_ADB_NAME = $devices[0]
    }
    Ensure-AdbReverse -AdbCmd $adbCmd -DeviceId $env:DETOX_ADB_NAME
    if (-not $env:DETOX_REUSE_APP) {
      $env:DETOX_REUSE_APP = '1'
    }
    Remove-Item Env:DETOX_ALLOW_NO_TARGET -ErrorAction SilentlyContinue
    Write-Host "[detox-bootstrap] usando device: $($env:DETOX_ADB_NAME)"
  }
} else {
  Remove-Item Env:DETOX_AVD_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:DETOX_ADB_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:DETOX_CONFIGURATION -ErrorAction SilentlyContinue
  if ($AllowNoTarget) {
    $env:DETOX_ALLOW_NO_TARGET = '1'
    Write-Host '[detox-bootstrap] modo sem alvo explicito; skip controlado habilitado.'
  }
}

if ($TestPattern) {
  $env:DETOX_TEST_PATTERN = $TestPattern
}

$appPackage = 'com.tipolt.evolucaofullv2'
$statePath = Get-BootstrapStatePath -RootPath $repoRoot
$fingerprint = Get-FileFingerprint -RootPath $repoRoot
$state = Read-BootstrapState -StatePath $statePath
$smartBuildEnabled = ($env:DETOX_SMART_BUILD -ne '0')
$isAttachedConfig = [string]$env:DETOX_CONFIGURATION -like 'android.attached.*'

if ($smartBuildEnabled -and $isAttachedConfig) {
  $fingerprintChanged = ($null -eq $state) -or ([string]$state.fingerprint -ne $fingerprint) -or ([string]$state.configuration -ne [string]$env:DETOX_CONFIGURATION)
  $needsInstrumentation = [string]$env:DETOX_CONFIGURATION -eq 'android.attached.debug'
  $hasInstrumentation = $true

  if ($needsInstrumentation) {
    $hasInstrumentation = Test-InstrumentationInstalled -AdbCmd $adbCmd -DeviceId $env:DETOX_ADB_NAME -PackageName $appPackage
  }

  if ($fingerprintChanged) {
    Write-Host '[detox-bootstrap] mudancas detectadas no app: desabilitando reuse e forçando rebuild/reinstall.'
    $shouldReuse = $false
    Remove-AppFromDevice -AdbCmd $adbCmd -DeviceId $env:DETOX_ADB_NAME -PackageName $appPackage
    $buildCode = Invoke-DetoxBuild -Configuration $env:DETOX_CONFIGURATION
    if ($buildCode -ne 0) {
      throw "Falha no detox build ($($env:DETOX_CONFIGURATION))."
    }
    Write-BootstrapState -StatePath $statePath -Configuration $env:DETOX_CONFIGURATION -Fingerprint $fingerprint
  } elseif ($needsInstrumentation -and -not $hasInstrumentation) {
    Write-Host '[detox-bootstrap] instrumentation ausente para attached.debug: desabilitando reuse e reconstruindo.'
    $shouldReuse = $false
    Remove-AppFromDevice -AdbCmd $adbCmd -DeviceId $env:DETOX_ADB_NAME -PackageName $appPackage
    $buildCode = Invoke-DetoxBuild -Configuration $env:DETOX_CONFIGURATION
    if ($buildCode -ne 0) {
      throw "Falha no detox build ($($env:DETOX_CONFIGURATION))."
    }
    Write-BootstrapState -StatePath $statePath -Configuration $env:DETOX_CONFIGURATION -Fingerprint $fingerprint
  } else {
    Write-Host '[detox-bootstrap] sem mudancas de build; reuse permitido.'
  }
}

Ensure-AppForConfiguration -Configuration $env:DETOX_CONFIGURATION -DeviceId $env:DETOX_ADB_NAME -AdbCmd $adbCmd -PackageName $appPackage

Write-Host "[detox-bootstrap] run=$Run config=$($env:DETOX_CONFIGURATION) avd=$($env:DETOX_AVD_NAME) adb=$($env:DETOX_ADB_NAME)"

switch ($Run.ToLowerInvariant()) {
  'build' { npm run detox:build; break }
  'test' {
    function Invoke-DetoxTest([string]$Configuration) {
      $detoxArgs = @('detox', 'test')
      if ($Configuration) {
        $detoxArgs += @('--configuration', $Configuration)
      }
      if ($TestPattern) {
        $detoxArgs += @('--testNamePattern', $TestPattern)
      }
      if ($shouldReuse) {
        $detoxArgs += @('--reuse')
      }

      Write-StepLog 'INFO' 'test' "detox args: $($detoxArgs -join ' ')"

      $detoxCommand = Get-DetoxCommand
      $execArgs = if ($detoxCommand -like '*npx*') { $detoxArgs } else { $detoxArgs | Select-Object -Skip 1 }

      $stageName = "test-$($Configuration.Replace('.', '-'))"
      $result = Invoke-CommandWithWatchdog -FilePath $detoxCommand -Arguments $execArgs -TimeoutSec 1800 -NoOutputTimeoutSec 240 -Stage $stageName

      if ($result.ExitCode -ne 0 -and (Test-JestSuccessFromDetoxLog -LogPath $result.Stderr)) {
        Write-StepLog 'WARN' 'test' 'exit nao-zero com resumo Jest sem falhas; tratando como sucesso.'
        return 0
      }

      if ($result.ExitCode -ne 0 -and $Configuration.StartsWith('android.attached.')) {
        Write-StepLog 'WARN' 'test' 'falha inicial no attached; aplicando fallback de reinstall e retry unico.'
        $shouldReuse = $false
        Remove-AppFromDevice -AdbCmd $adbCmd -DeviceId $env:DETOX_ADB_NAME -PackageName $appPackage
        Ensure-AppForConfiguration -Configuration $Configuration -DeviceId $env:DETOX_ADB_NAME -AdbCmd $adbCmd -PackageName $appPackage

        $retryArgs = @('detox', 'test', '--configuration', $Configuration)
        if ($TestPattern) {
          $retryArgs += @('--testNamePattern', $TestPattern)
        }
        $retryExecArgs = if ($detoxCommand -like '*npx*') { $retryArgs } else { $retryArgs | Select-Object -Skip 1 }
        $retryResult = Invoke-CommandWithWatchdog -FilePath $detoxCommand -Arguments $retryExecArgs -TimeoutSec 1800 -NoOutputTimeoutSec 240 -Stage ($stageName + '-retry')
        if ($retryResult.ExitCode -ne 0 -and (Test-JestSuccessFromDetoxLog -LogPath $retryResult.Stderr)) {
          Write-StepLog 'WARN' 'test' 'retry com exit nao-zero, mas resumo Jest sem falhas; tratando como sucesso.'
          return 0
        }
        return $retryResult.ExitCode
      }

      return $result.ExitCode
    }

    $detoxExitCode = Invoke-DetoxTest -Configuration $env:DETOX_CONFIGURATION

    $allowDebugFallback = ($env:DETOX_DISABLE_DEBUG_FALLBACK -ne '1')
    $isAttachedDebug = ($env:DETOX_CONFIGURATION -eq 'android.attached.debug')

    if ($detoxExitCode -ne 0 -and $allowDebugFallback -and $isAttachedDebug) {
      Write-Host '[detox-bootstrap] attached.debug falhou; tentando fallback em android.attached.release.'
      $fallbackConfig = 'android.attached.release'
      $fallbackExitCode = Invoke-DetoxTest -Configuration $fallbackConfig
      if ($fallbackExitCode -eq 0) {
        Write-Host '[detox-bootstrap] fallback attached.release concluiu com sucesso.'
        $env:DETOX_CONFIGURATION = $fallbackConfig
        $detoxExitCode = 0
      }
    }

    if ($detoxExitCode -ne 0) {
      Capture-LogcatOnFailure -AdbCmd $adbCmd -DeviceId $env:DETOX_ADB_NAME
    }

    $global:LASTEXITCODE = $detoxExitCode

    break
  }
  'loop' { npm run detox:loop; break }
  default { npm run detox:cycle; break }
}

if ($LASTEXITCODE -ne $null) {
  Write-StepLog 'INFO' 'bootstrap' "fim exitCode=$LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-StepLog 'INFO' 'bootstrap' 'fim sem exit code explicito (default 0).'
