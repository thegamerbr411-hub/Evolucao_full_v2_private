$ErrorActionPreference = 'Stop'
$base = 'https://evolucao-api-dou2.onrender.com'

function To-B64([string]$s) {
  return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Make-Token([string]$email) {
  $header = To-B64('{"alg":"HS256","typ":"JWT"}')
  $payload = To-B64((@{ email = $email; name = 'thegamerbr'; sub = 'sub-admin' } | ConvertTo-Json -Compress))
  return "$header.$payload.sig"
}

for ($i = 1; $i -le 16; $i++) {
  Write-Output "--- check deploy admin $i ---"

  try {
    $h = Invoke-RestMethod -Uri "$base/health" -Method Get -TimeoutSec 35
    Write-Output ("health ok=" + $h.ok)
  } catch {
    Write-Output ("health fail: " + $_.Exception.Message)
  }

  try {
    Invoke-RestMethod -Uri "$base/auth/google" -Method Post -ContentType 'application/json' -Body '{"token":"invalid.token.payload"}' -TimeoutSec 35 | Out-Null
    Write-Output 'google invalid: UNEXPECTED SUCCESS'
  } catch {
    if ($_.Exception.Response) {
      Write-Output ("google invalid: rejected " + [int]$_.Exception.Response.StatusCode)
    } else {
      Write-Output ("google invalid fail: " + $_.Exception.Message)
    }
  }

  try {
    $token = Make-Token 'thegamerbr411@gmail.com'
    $resp = Invoke-RestMethod -Uri "$base/auth/google" -Method Post -ContentType 'application/json' -Body ((@{ token = $token } | ConvertTo-Json -Compress)) -TimeoutSec 35
    Write-Output ("thegamer role=" + $resp.user.role + " admin=" + $resp.user.isAdmin)
  } catch {
    if ($_.Exception.Response) {
      Write-Output ("thegamer login rejected " + [int]$_.Exception.Response.StatusCode)
    } else {
      Write-Output ("thegamer login fail " + $_.Exception.Message)
    }
  }

  Start-Sleep -Seconds 12
}
