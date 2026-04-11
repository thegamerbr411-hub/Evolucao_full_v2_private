param(
  [string]$Mode = 'auto',
  [string]$Run = 'cycle',
  [string]$TestPattern = '',
  [switch]$AllowNoTarget = $true
)

$ErrorActionPreference = 'Stop'

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
    & $AdbCmd -s $DeviceId reverse tcp:8081 tcp:8081 | Out-Null
    & $AdbCmd -s $DeviceId reverse tcp:3000 tcp:3000 | Out-Null
    Write-Host "[detox-bootstrap] adb reverse ok for $DeviceId (8081,3000)"
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
    $env:DETOX_CONFIGURATION = if ($env:DETOX_ATTACHED_CONFIGURATION) { $env:DETOX_ATTACHED_CONFIGURATION } else { 'android.attached.release' }
    $env:DETOX_ADB_NAME = $devices[0]
    Ensure-AdbReverse -AdbCmd $adbCmd -DeviceId $devices[0]
    Remove-Item Env:DETOX_ALLOW_NO_TARGET -ErrorAction SilentlyContinue
    Write-Host "[detox-bootstrap] usando device: $($devices[0])"
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

Write-Host "[detox-bootstrap] run=$Run config=$($env:DETOX_CONFIGURATION) avd=$($env:DETOX_AVD_NAME) adb=$($env:DETOX_ADB_NAME)"

switch ($Run.ToLowerInvariant()) {
  'build' { npm run detox:build; break }
  'test' {
    $detoxArgs = @('detox', 'test')
    if ($env:DETOX_CONFIGURATION) {
      $detoxArgs += @('--configuration', $env:DETOX_CONFIGURATION)
    }
    if ($TestPattern) {
      $detoxArgs += @('--testNamePattern', $TestPattern)
    }

    if (Get-Command npx -ErrorAction SilentlyContinue) {
      & npx @detoxArgs
    } else {
      & npx.cmd @detoxArgs
    }

    if ($LASTEXITCODE -ne 0) {
      Capture-LogcatOnFailure -AdbCmd $adbCmd -DeviceId $env:DETOX_ADB_NAME
    }

    break
  }
  'loop' { npm run detox:loop; break }
  default { npm run detox:cycle; break }
}
