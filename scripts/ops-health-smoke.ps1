param(
  [string]$BaseUrl = "https://evolucao-api-dou2.onrender.com"
)

$ErrorActionPreference = 'Stop'
$script:FailCount = 0

function Probe([string]$Path, [int]$ExpectedStatus, [string]$Method = 'GET', [string]$Body = '{}') {
  $url = "$BaseUrl$Path"
  $status = $null
  try {
    if ($Method -eq 'GET') {
      $resp = Invoke-WebRequest -Uri $url -Method Get -UseBasicParsing -TimeoutSec 40
    } else {
      $resp = Invoke-WebRequest -Uri $url -Method $Method -ContentType 'application/json' -Body $Body -UseBasicParsing -TimeoutSec 40
    }
    $status = [int]$resp.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    } else {
      Write-Output "FAIL $Path error=$($_.Exception.Message)"
      $script:FailCount += 1
      return
    }
  }

  if ($status -eq $ExpectedStatus) {
    Write-Output "OK $Path status=$status"
  } else {
    Write-Output "FAIL $Path status=$status expected=$ExpectedStatus"
    $script:FailCount += 1
  }
}

Write-Output "[SMOKE] BaseUrl=$BaseUrl"
Probe -Path '/health' -ExpectedStatus 200
Probe -Path '/api/health' -ExpectedStatus 200
Probe -Path '/auth/login-password' -ExpectedStatus 400 -Method 'POST' -Body '{}'
Probe -Path '/api/auth/login-password' -ExpectedStatus 400 -Method 'POST' -Body '{}'
Probe -Path '/auth/send-code' -ExpectedStatus 400 -Method 'POST' -Body '{}'
Probe -Path '/api/auth/send-code' -ExpectedStatus 400 -Method 'POST' -Body '{}'

Write-Output '[SMOKE] Esperado: health=200 e auth=400 (rota existente exigindo payload).'

if ($script:FailCount -gt 0) {
  Write-Output "[SMOKE] FAIL count=$script:FailCount"
  exit 1
}

Write-Output '[SMOKE] PASS'
exit 0
