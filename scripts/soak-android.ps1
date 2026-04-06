param(
  [string]$PackageName = "com.evolucao.app",
  [int]$DurationMinutes = 120,
  [int]$EventsPerIteration = 220,
  [int]$ThrottleMs = 80,
  [int]$MaxIterations = 0,
  [string]$OutputDir = "soak-logs",
  [bool]$RunDetoxFirst = $true
)

$ErrorActionPreference = "Stop"

if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Get-AdbPath {
  $candidate = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
  if (Test-Path $candidate) {
    return $candidate
  }
  return "adb"
}

$adb = Get-AdbPath
$root = Split-Path -Parent $PSScriptRoot
$logsRoot = Join-Path $root $OutputDir
$runStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $logsRoot $runStamp
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$summary = [System.Collections.Generic.List[object]]::new()
$start = Get-Date
$deadline = $start.AddMinutes($DurationMinutes)

Write-Host "[soak] package=$PackageName duration=${DurationMinutes}min events=$EventsPerIteration throttle=${ThrottleMs}ms"
Write-Host "[soak] logs: $runDir"

if ($RunDetoxFirst) {
  Write-Host "[soak] executando Detox antes do monkey..."
  Push-Location $root
  try {
    & npm run build:e2e
    if ($LASTEXITCODE -ne 0) {
      throw "Build do Detox falhou (exitcode=$LASTEXITCODE)."
    }

    & npm run test:e2e
    if ($LASTEXITCODE -ne 0) {
      throw "Detox falhou (exitcode=$LASTEXITCODE)."
    }
    Write-Host "[soak] Detox OK. Iniciando monkey soak..."
  } finally {
    Pop-Location
  }
}

$devicesOutput = & $adb devices
$connected = $devicesOutput | Select-String "\tdevice$"
if (-not $connected) {
  throw "Nenhum dispositivo Android autorizado encontrado (adb devices)."
}

$iteration = 0
while ((Get-Date) -lt $deadline) {
  if ($MaxIterations -gt 0 -and $iteration -ge $MaxIterations) {
    break
  }

  $iteration += 1
  $iterStart = Get-Date
  Write-Host "[soak] iteracao $iteration iniciando..."

  & $adb logcat -c | Out-Null
  & $adb shell am start -n "$PackageName/.MainActivity" | Out-Null

  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $monkeyOutput = & $adb shell monkey -p $PackageName --pct-syskeys 0 --throttle $ThrottleMs -v $EventsPerIteration 2>&1
  $monkeyExitCode = $LASTEXITCODE
  $ErrorActionPreference = $prevErrorAction
  $monkeyPath = Join-Path $runDir ("iter-{0:D4}-monkey.txt" -f $iteration)
  $monkeyOutput | Set-Content -Encoding UTF8 -Path $monkeyPath

  $logOutput = & $adb logcat -d -v time AndroidRuntime:E ReactNativeJS:E ReactNative:V "*:S"
  $logPath = Join-Path $runDir ("iter-{0:D4}-logcat.txt" -f $iteration)
  $logOutput | Set-Content -Encoding UTF8 -Path $logPath

  $errorPattern = "FATAL EXCEPTION|TypeError|Unable to load script|Could not connect to development server|JavascriptException|Unhandled|ANR"
  $errors = $logOutput | Select-String -Pattern $errorPattern

  $status = "ok"
  $monkeyText = ($monkeyOutput | Out-String)
  $monkeyFailed = $monkeyExitCode -ne 0 -and ($monkeyText -notmatch "Monkey finished")

  if ($monkeyFailed) {
    $status = "error"
    $monkeyErrorPath = Join-Path $runDir ("iter-{0:D4}-monkey-error.txt" -f $iteration)
    @(
      "monkey_exit_code=$monkeyExitCode",
      "monkey_output=",
      $monkeyText
    ) | Set-Content -Encoding UTF8 -Path $monkeyErrorPath
    Write-Host "[soak] iteracao $iteration monkey retornou erro. Veja: $monkeyErrorPath"
  }

  if ($errors) {
    $status = "error"
    $errorPath = Join-Path $runDir ("iter-{0:D4}-errors.txt" -f $iteration)
    $errors | Set-Content -Encoding UTF8 -Path $errorPath
    Write-Host "[soak] iteracao $iteration encontrou erro. Veja: $errorPath"
  } else {
    Write-Host "[soak] iteracao $iteration sem erro critico."
  }

  $iterEnd = Get-Date
  $summary.Add([PSCustomObject]@{
    iteration = $iteration
    startedAt = $iterStart.ToString("s")
    finishedAt = $iterEnd.ToString("s")
    status = $status
    monkeyLog = [System.IO.Path]::GetFileName($monkeyPath)
    logcatLog = [System.IO.Path]::GetFileName($logPath)
  }) | Out-Null
}

$end = Get-Date
$total = $summary.Count
$errorsCount = ($summary | Where-Object { $_.status -eq "error" }).Count
$okCount = $total - $errorsCount

$summaryObj = [PSCustomObject]@{
  package = $PackageName
  startedAt = $start.ToString("s")
  finishedAt = $end.ToString("s")
  durationMinutesRequested = $DurationMinutes
  iterationsRequested = $MaxIterations
  eventsPerIteration = $EventsPerIteration
  throttleMs = $ThrottleMs
  totalIterations = $total
  okIterations = $okCount
  errorIterations = $errorsCount
  iterations = $summary
}

$summaryJsonPath = Join-Path $runDir "summary.json"
$summaryTxtPath = Join-Path $runDir "summary.txt"

$summaryObj | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -Path $summaryJsonPath
@(
  "soak-summary",
  "package=$PackageName",
  "startedAt=$($start.ToString('s'))",
  "finishedAt=$($end.ToString('s'))",
  "totalIterations=$total",
  "okIterations=$okCount",
  "errorIterations=$errorsCount",
  "eventsPerIteration=$EventsPerIteration",
  "throttleMs=$ThrottleMs",
  "summaryJson=$summaryJsonPath"
) | Set-Content -Encoding UTF8 -Path $summaryTxtPath

Write-Host "[soak] finalizado."
Write-Host "[soak] ok=$okCount erro=$errorsCount total=$total"
Write-Host "[soak] resumo: $summaryTxtPath"
