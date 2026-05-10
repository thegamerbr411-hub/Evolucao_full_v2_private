#Requires -Version 5.1
<#
.SYNOPSIS
  Phase 9 orchestrator: final blocker elimination + focused real validation.
#>

param(
  [string]$AdbName = $env:DETOX_ADB_NAME,
  [string]$DetoxConfiguration = $(if ($env:DETOX_CONFIGURATION) { $env:DETOX_CONFIGURATION } else { 'android.attached.debug' }),
  [switch]$SkipExecution = $false,
  [switch]$SkipVideo = $false,
  [switch]$SkipAnalyze = $false,
  [switch]$SkipOAuthAudit = $false,
  [switch]$HumanPrompt = $false,
  [switch]$TestCredentials = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$OutRoot = Join-Path $ProjectRoot 'qa_phase9_final_blockers'
$RunsRoot = Join-Path $OutRoot 'QA_RUNS'
$FocusedRunDir = Join-Path $RunsRoot ('focused\run_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$OAuthDir = Join-Path $RunsRoot 'oauth'
$VideoDir = Join-Path $RunsRoot 'video'
$HumanDir = Join-Path $RunsRoot 'human'

$AdbExe = (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
if (-not (Test-Path $AdbExe)) { $AdbExe = 'adb' }

function Write-PhaseLog {
  param([string]$Message)
  Write-Host "[PHASE9] $(Get-Date -Format 'HH:mm:ss') $Message"
}

function New-Directory {
  param([string]$Path)
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Resolve-Device {
  param([string]$Requested)

  if ($Requested) {
    return $Requested
  }

  try {
    $raw = & $AdbExe devices 2>$null
    $devices = ($raw | Select-String '\tdevice$') -replace '\tdevice', ''
    if ($devices) {
      return ($devices | Select-Object -First 1).ToString().Trim()
    }
  } catch {
    return ''
  }

  return ''
}

function Invoke-FocusedTest {
  param(
    [string]$TestPath,
    [string]$RunDir
  )

  $testLeaf = Split-Path $TestPath -Leaf
  $logDir = Join-Path $RunDir 'logs'
  New-Directory $logDir

  $logPath = Join-Path $logDir ($testLeaf -replace '\.e2e\.js$', '.log')

  $jestExe = '.\\node_modules\\.bin\\jest.cmd'
  $jestArgs = @(
    '--config', 'e2e/jest.config.js',
    '--runTestsByPath', $TestPath,
    '--forceExit',
    '--detectOpenHandles'
  )

  $start = Get-Date
  $exitCode = 0

  Write-PhaseLog "Running focused test: $testLeaf"
  try {
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $jestExe @jestArgs 2>&1 | Tee-Object -FilePath $logPath | Out-Null
    $ErrorActionPreference = $prevErrorAction
    $exitCode = $LASTEXITCODE
  } catch {
    $exitCode = 1
    Add-Content -Path $logPath -Value "[runner_error] $($_.Exception.Message)"
  } finally {
    $ErrorActionPreference = 'Stop'
  }

  $duration = [Math]::Round(((Get-Date) - $start).TotalSeconds, 1)

  [PSCustomObject]@{
    test = $testLeaf
    path = $TestPath
    log = $logPath
    durationSec = $duration
    exitCode = $exitCode
    status = if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' }
  }
}

New-Directory $OutRoot
New-Directory $RunsRoot
New-Directory $FocusedRunDir
New-Directory $OAuthDir
New-Directory $VideoDir
New-Directory $HumanDir

Push-Location $ProjectRoot
try {
  $resolvedDevice = Resolve-Device -Requested $AdbName
  if ($resolvedDevice) {
    $env:DETOX_ADB_NAME = $resolvedDevice
    Write-PhaseLog "Using device: $resolvedDevice"
  } else {
    Write-PhaseLog 'No explicit device found; keeping Detox auto-detect mode.'
  }

  $env:DETOX_CONFIGURATION = $DetoxConfiguration
  Write-PhaseLog "Detox configuration: $DetoxConfiguration"

  $tests = @(
    'e2e/13-social-ux-audit.e2e.js',
    'e2e/16-treino-tab-smoke.e2e.js',
    'e2e/21-profile-save.e2e.js',
    'e2e/22-paywall-trial.e2e.js'
  )

  if ($TestCredentials) {
    Write-PhaseLog 'Credential mode enabled when QA_TEST_EMAIL/QA_TEST_PASSWORD are present.'
  }

  if (-not $SkipExecution) {
    $videoOnDevice = '/sdcard/phase9_full_validation.mp4'
    $videoLocal = Join-Path $VideoDir ('full_human_validation_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.mp4')
    $recordJob = $null

    if (-not $SkipVideo) {
      Write-PhaseLog 'Starting continuous recording for focused phase9 run...'
      $recordArgs = @('shell', 'screenrecord', '--size', '720x1280', '--bit-rate', '2500000', $videoOnDevice)
      if ($resolvedDevice) { $recordArgs = @('-s', $resolvedDevice) + $recordArgs }

      $recordJob = Start-Job -ScriptBlock {
        param($exe, $argsList)
        & $exe @argsList
      } -ArgumentList $AdbExe, (,$recordArgs)
    }

    $results = New-Object System.Collections.Generic.List[object]
    try {
      foreach ($test in $tests) {
        $result = Invoke-FocusedTest -TestPath $test -RunDir $FocusedRunDir
        $results.Add($result)
      }
    } finally {
      if ($recordJob) {
        Stop-Job -Job $recordJob -ErrorAction SilentlyContinue | Out-Null
        Remove-Job -Job $recordJob -ErrorAction SilentlyContinue | Out-Null

        try {
          $pullArgs = @('pull', $videoOnDevice, $videoLocal)
          if ($resolvedDevice) { $pullArgs = @('-s', $resolvedDevice) + $pullArgs }
          & $AdbExe @pullArgs | Out-Null

          $rmArgs = @('shell', 'rm', $videoOnDevice)
          if ($resolvedDevice) { $rmArgs = @('-s', $resolvedDevice) + $rmArgs }
          & $AdbExe @rmArgs | Out-Null
        } catch {
          Write-PhaseLog 'Could not pull continuous phase9 video from device.'
        }
      }
    }

    $reportFile = Join-Path $FocusedRunDir 'report.md'
    $status = if (($results | Where-Object { $_.exitCode -ne 0 }).Count -eq 0) { 'PASS' } else { 'FAIL' }
    $deviceLabel = if ($resolvedDevice) { $resolvedDevice } else { 'auto-detectado' }
    $rows = @()
    foreach ($row in $results) {
      $rows += "| $($row.test) | $($row.status) | $($row.durationSec)s | $($row.exitCode) |"
    }

    $reportLines = @(
      '# Phase 9 Focused Blockers Report',
      '',
      "**Status:** $status",
      "**Data:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
      "**Device:** $deviceLabel",
      "**Run dir:** $FocusedRunDir",
      '',
      '## Resultados por teste',
      '| Teste | Status | Duracao | Exit |',
      '| ----- | ------ | ------- | ---- |'
    )
    $reportLines += $rows

    Set-Content -Path $reportFile -Value $reportLines -Encoding UTF8
    Write-PhaseLog "Focused report written: $reportFile"
  }

  if (-not $SkipOAuthAudit) {
    Write-PhaseLog 'Collecting OAuth keystore and google-services audit...'

    $audit = [ordered]@{
      timestamp = (Get-Date).ToString('s')
      device = if ($resolvedDevice) { $resolvedDevice } else { '' }
      googleServicesPath = 'android/app/google-services.json'
      debugKeystorePath = "$env:USERPROFILE\.android\debug.keystore"
      debugSha1 = ''
      debugSha256 = ''
      keytoolAvailable = $false
      keytoolRaw = ''
    }

    $googlePath = Join-Path $ProjectRoot 'android\app\google-services.json'
    if (Test-Path $googlePath) {
      try {
        $googleJson = Get-Content -Path $googlePath -Raw | ConvertFrom-Json
        $oauthCount = 0
        if ($googleJson.client -and $googleJson.client[0] -and $googleJson.client[0].oauth_client) {
          $oauthCount = @($googleJson.client[0].oauth_client).Count
        }
        $audit['googleOauthClients'] = $oauthCount
      } catch {
        $audit['googleOauthClients'] = 0
      }
    } else {
      $audit['googleOauthClients'] = 0
    }

    $keytoolCmd = Get-Command keytool -ErrorAction SilentlyContinue
    if ($keytoolCmd) {
      $audit.keytoolAvailable = $true
      $keystorePath = "$env:USERPROFILE\.android\debug.keystore"
      if (Test-Path $keystorePath) {
        try {
          $raw = & keytool -list -v -alias androiddebugkey -keystore $keystorePath -storepass android -keypass android 2>&1 | Out-String
          $audit.keytoolRaw = $raw

          $sha1 = (($raw | Select-String 'SHA1:' | Select-Object -First 1).ToString() -replace '.*SHA1:\s*', '').Trim()
          $sha256 = (($raw | Select-String 'SHA256:' | Select-Object -First 1).ToString() -replace '.*SHA256:\s*', '').Trim()
          $audit.debugSha1 = $sha1
          $audit.debugSha256 = $sha256
        } catch {
          $audit.keytoolRaw = "keytool_error: $($_.Exception.Message)"
        }
      }
    }

    $auditPath = Join-Path $OAuthDir 'oauth_audit.json'
    ($audit | ConvertTo-Json -Depth 8) | Set-Content -Path $auditPath -Encoding UTF8
    Write-PhaseLog "OAuth audit written: $auditPath"
  }

  if ($HumanPrompt) {
    Write-PhaseLog 'Collecting human validation checklist answers...'
    $human = [ordered]@{
      timestamp = (Get-Date).ToString('s')
      operator = Read-Host 'Operador responsável'
      googleLoginExecuted = Read-Host 'Login Google real executado? (sim/nao)'
      otpRequired = Read-Host 'OTP/captcha solicitado no fluxo? (sim/nao)'
      otpCompleted = Read-Host 'OTP/captcha concluido sem erro? (sim/nao)'
      continuousVideoCaptured = Read-Host 'Video continuo completo sem cortes capturado? (sim/nao)'
      notes = Read-Host 'Observacoes finais'
    }

    $humanPath = Join-Path $HumanDir 'human_validation_input.json'
    ($human | ConvertTo-Json -Depth 5) | Set-Content -Path $humanPath -Encoding UTF8
    Write-PhaseLog "Human validation input written: $humanPath"
  }

  if (-not $SkipAnalyze) {
    Write-PhaseLog 'Generating phase9 final blocker reports...'
    & node 'scripts/qa_phase9/analyze_final_blockers.js'
  }

  Write-PhaseLog 'Phase 9 final blockers artifacts ready.'
} finally {
  Pop-Location
}
