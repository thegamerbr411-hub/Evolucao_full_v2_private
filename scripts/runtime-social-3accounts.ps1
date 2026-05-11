$ErrorActionPreference = 'Stop'

trap {
  Write-Output ("ERRO_GLOBAL: " + $_.Exception.Message)
  continue
}
$base = 'https://evolucao-api-dou2.onrender.com'

function To-B64Url([string]$text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-FakeJwt([string]$email, [string]$name, [string]$sub) {
  $header = To-B64Url('{"alg":"HS256","typ":"JWT"}')
  $payloadObj = @{ email = $email; name = $name; sub = $sub }
  $payloadJson = $payloadObj | ConvertTo-Json -Compress
  $payload = To-B64Url($payloadJson)
  return "$header.$payload.sig"
}

function Login-GoogleFake([string]$email, [string]$name, [string]$sub) {
  $token = New-FakeJwt $email $name $sub
  $body = @{ token = $token } | ConvertTo-Json -Compress
  return Invoke-RestMethod -Uri "$base/auth/google" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 120
}

$u1 = Login-GoogleFake 'revendafreefire04@gmail.com' 'Conta Google Device' 'sub-google-1'
$u2 = Login-GoogleFake 'qa.email.sem.google+1@outlook.com' 'Conta Email Sem Google' 'sub-email-2'
$u3 = Login-GoogleFake 'thegamerbr411@gmail.com' 'thegamerbr' 'sub-admin-3'

Write-Output 'USERS:'
@($u1, $u2, $u3) | ForEach-Object { Write-Output ("- {0} | id={1} | role={2} | admin={3}" -f $_.user.email, $_.user.id, $_.user.role, $_.user.isAdmin) }

$h1 = @{ Authorization = "Bearer $($u1.accessToken)" }
$h2 = @{ Authorization = "Bearer $($u2.accessToken)" }
$h3 = @{ Authorization = "Bearer $($u3.accessToken)" }

try { Invoke-RestMethod -Uri "$base/social/friends/add" -Method Post -Headers $h1 -ContentType 'application/json' -Body (@{ friendId = $u2.user.id } | ConvertTo-Json -Compress) | Out-Null; Write-Output 'friends 1->2 ok' } catch { Write-Output ("friends 1->2 fail: " + $_.Exception.Message) }
try { Invoke-RestMethod -Uri "$base/social/friends/add" -Method Post -Headers $h1 -ContentType 'application/json' -Body (@{ friendId = $u3.user.id } | ConvertTo-Json -Compress) | Out-Null; Write-Output 'friends 1->3 ok' } catch { Write-Output ("friends 1->3 fail: " + $_.Exception.Message) }
try { Invoke-RestMethod -Uri "$base/social/friends/add" -Method Post -Headers $h2 -ContentType 'application/json' -Body (@{ friendId = $u1.user.id } | ConvertTo-Json -Compress) | Out-Null; Write-Output 'friends 2->1 ok' } catch { Write-Output ("friends 2->1 fail: " + $_.Exception.Message) }
try { Invoke-RestMethod -Uri "$base/social/friends/add" -Method Post -Headers $h3 -ContentType 'application/json' -Body (@{ friendId = $u1.user.id } | ConvertTo-Json -Compress) | Out-Null; Write-Output 'friends 3->1 ok' } catch { Write-Output ("friends 3->1 fail: " + $_.Exception.Message) }

try { Invoke-RestMethod -Uri "$base/social/feed" -Method Post -Headers $h1 -ContentType 'application/json' -Body (@{ text = 'Treino A - Forca'; xp = 140; data = @{ totalVolume = 8200 } } | ConvertTo-Json -Compress) | Out-Null; Write-Output 'feed u1 ok' } catch { Write-Output ("feed u1 fail: " + $_.Exception.Message) }
try { Invoke-RestMethod -Uri "$base/social/feed" -Method Post -Headers $h2 -ContentType 'application/json' -Body (@{ text = 'Treino B - HIIT'; xp = 95; data = @{ totalVolume = 5100 } } | ConvertTo-Json -Compress) | Out-Null; Write-Output 'feed u2 ok' } catch { Write-Output ("feed u2 fail: " + $_.Exception.Message) }
try { Invoke-RestMethod -Uri "$base/social/feed" -Method Post -Headers $h3 -ContentType 'application/json' -Body (@{ text = 'Treino C - FullBody'; xp = 180; data = @{ totalVolume = 9900 } } | ConvertTo-Json -Compress) | Out-Null; Write-Output 'feed u3 ok' } catch { Write-Output ("feed u3 fail: " + $_.Exception.Message) }

try { $ov1 = Invoke-RestMethod -Uri "$base/social/overview" -Method Get -Headers $h1; Write-Output 'overview u1 ok' } catch { Write-Output ("overview u1 fail: " + $_.Exception.Message) }
try { $ov2 = Invoke-RestMethod -Uri "$base/social/overview" -Method Get -Headers $h2; Write-Output 'overview u2 ok' } catch { Write-Output ("overview u2 fail: " + $_.Exception.Message) }
try { $ov3 = Invoke-RestMethod -Uri "$base/social/overview" -Method Get -Headers $h3; Write-Output 'overview u3 ok' } catch { Write-Output ("overview u3 fail: " + $_.Exception.Message) }

Write-Output "`nRANKING (conta1):"
if ($ov1 -and $ov1.data) { $ov1.data.friendsLeaderboard | Select-Object position, username, xp, workoutsCount, totalVolume, isCurrentUser | Format-Table -AutoSize }

Write-Output "`nRANKING (conta2):"
if ($ov2 -and $ov2.data) { $ov2.data.friendsLeaderboard | Select-Object position, username, xp, workoutsCount, totalVolume, isCurrentUser | Format-Table -AutoSize }

Write-Output "`nRANKING (conta3):"
if ($ov3 -and $ov3.data) { $ov3.data.friendsLeaderboard | Select-Object position, username, xp, workoutsCount, totalVolume, isCurrentUser | Format-Table -AutoSize }

try { $ch1 = Invoke-RestMethod -Uri "$base/social/challenges" -Method Post -Headers $h3 -ContentType 'application/json' -Body (@{ title = 'Desafio Global: 3 treinos na semana'; target = 3; type = 'workouts_count' } | ConvertTo-Json -Compress) } catch { Write-Output ("challenge 1 fail: " + $_.Exception.Message) }
try { $ch2 = Invoke-RestMethod -Uri "$base/social/challenges" -Method Post -Headers $h3 -ContentType 'application/json' -Body (@{ title = 'Desafio Individual: thegamerbr foco maximo'; target = 1; type = 'workouts_count' } | ConvertTo-Json -Compress) } catch { Write-Output ("challenge 2 fail: " + $_.Exception.Message) }

Write-Output "`nCHALLENGES CRIADOS:"
if ($ch1 -and $ch1.data) { Write-Output ("- {0} | id={1} | createdBy={2}" -f $ch1.data.title, $ch1.data.id, $ch1.data.createdBy) }
if ($ch2 -and $ch2.data) { Write-Output ("- {0} | id={1} | createdBy={2}" -f $ch2.data.title, $ch2.data.id, $ch2.data.createdBy) }

Write-Output "`nFRIENDS COUNTS:"
if ($ov1 -and $ov1.data) { Write-Output ("- conta1 friends={0}" -f $ov1.data.friends.Count) }
if ($ov2 -and $ov2.data) { Write-Output ("- conta2 friends={0}" -f $ov2.data.friends.Count) }
if ($ov3 -and $ov3.data) { Write-Output ("- conta3 friends={0}" -f $ov3.data.friends.Count) }
