$ErrorActionPreference = 'Continue'

$env:DETOX_CONFIGURATION = 'android.emulator.debug'
$env:DETOX_ADB_NAME = 'emulator-5554'
$env:DETOX_CLEANUP = '1'
$env:QA_AUTOSTART_SERVER = '1'

$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:Path = "$($sdkRoot)\platform-tools;$($sdkRoot)\emulator;" + $env:Path

$outJson = 'qa/emulator-10x-report-fast.json'
$logDir = 'qa/tmp-accurate-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Save-Report {
  param([array]$Items)
  $Items | Sort-Object cycle | ConvertTo-Json -Depth 6 | Set-Content $outJson -Encoding utf8
}

# Limpa processos antigos para reduzir interferencia entre ciclos.
Get-Process -Name emulator,qemu-system-x86_64,node -ErrorAction SilentlyContinue |
  Where-Object { $_.StartTime -gt (Get-Date).AddHours(-2) } |
  Stop-Process -Force -ErrorAction SilentlyContinue

$results = @()
$results += [PSCustomObject]@{ cycle = 1; status = 'timeout'; exitCode = 124; detoxExitCode = $null; startedAt = $null; finishedAt = $null; configuration = 'android.emulator.debug'; fatalError = $null }
$results += [PSCustomObject]@{ cycle = 2; status = 'timeout'; exitCode = 124; detoxExitCode = $null; startedAt = $null; finishedAt = $null; configuration = 'android.emulator.debug'; fatalError = $null }
$results += [PSCustomObject]@{ cycle = 3; status = 'timeout'; exitCode = 124; detoxExitCode = $null; startedAt = $null; finishedAt = $null; configuration = 'android.emulator.debug'; fatalError = $null }

Save-Report -Items $results

for ($i = 4; $i -le 10; $i++) {
  Write-Host "`n[10x-emulator-accurate] ciclo $i/10 iniciado"
  $started = Get-Date
  $outLog = Join-Path $logDir ("cycle-{0:00}.out.log" -f $i)
  $errLog = Join-Path $logDir ("cycle-{0:00}.err.log" -f $i)

  $p = Start-Process -FilePath node -ArgumentList 'scripts/run-detox-cycle.js' -PassThru -NoNewWindow -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  $timedOut = $false

  try {
    Wait-Process -Id $p.Id -Timeout 180 -ErrorAction Stop
  } catch {
    $timedOut = $true
  }

  $report = $null
  if (Test-Path 'artifacts/detox-cycle-last.json') {
    try {
      $report = Get-Content 'artifacts/detox-cycle-last.json' -Raw | ConvertFrom-Json
    } catch {
      $report = $null
    }
  }

  if ($timedOut) {
    try { taskkill /PID $p.Id /T /F | Out-Null } catch {}
    $exit = 124
    $detoxExit = if ($report) { [int]$report.exitCode } else { $null }
    $status = 'timeout'
    $fatalError = if ($report) { $report.fatalError } else { 'cycle_timeout' }
  } else {
    $exit = [int]$p.ExitCode
    $detoxExit = if ($report) { [int]$report.exitCode } else { $null }
    $fatalError = if ($report) { $report.fatalError } else { $null }
    if ($detoxExit -ne $null) {
      $status = if ($detoxExit -eq 0) { 'pass' } else { 'fail' }
    } else {
      $status = if ($exit -eq 0) { 'pass' } else { 'fail' }
    }
  }

  if ($status -eq 'fail' -and $fatalError -match 'disk|space|storage|emulator_disk_space_insufficient') {
    $status = 'infra-fail'
  }

  if ($status -eq 'fail' -and $fatalError -eq $null) {
    $fatalError = 'detox_or_test_failure'
  }

  $results += [PSCustomObject]@{
    cycle = $i
    status = $status
    exitCode = $exit
    detoxExitCode = $detoxExit
    startedAt = $started.ToString('s')
    finishedAt = (Get-Date).ToString('s')
    configuration = if ($report) { $report.configuration } else { $null }
    fatalError = $fatalError
  }

  if (($results[-1].fatalError -eq $null) -and ($status -eq 'fail')) {
    $results[-1].fatalError = 'detox_or_test_failure'
  }

  Save-Report -Items $results

  Write-Host ("[10x-emulator-accurate] ciclo {0}/10 => {1} (proc={2}, detox={3}, out={4})" -f $i, $status, $exit, $detoxExit, $outLog)
}

Save-Report -Items $results
Write-Host "`n[10x-emulator-accurate] resumo salvo em $outJson"
$results | Sort-Object cycle | Format-Table -AutoSize | Out-String
