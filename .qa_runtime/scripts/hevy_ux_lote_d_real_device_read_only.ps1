param(
  [string]$Serial = "RQ8T209ZTAF",
  [string]$Package = "com.tipolt.evolucaofullv2",
  [string]$OutDir = ".qa_runtime\visual_audit\hevy_ux_lote_d_real_device_read_only"
)
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
New-Item -ItemType Directory -Force $OutDir | Out-Null
$unlockUsed = $false
function Capture($name) {
  & $adb -s $Serial exec-out screencap -p > (Join-Path $OutDir "$name.png")
}
$state = & $adb -s $Serial get-state 2>&1
if ($state -notmatch 'device') { throw 'DEVICE_UNAVAILABLE' }
& $adb -s $Serial shell monkey -p $Package 1 | Out-Null
Start-Sleep -Seconds 3
Capture "01_real_home"
& $adb -s $Serial shell input tap 270 2116
Start-Sleep -Seconds 2
Capture "02_real_treino_hub"
$xml = & $adb -s $Serial shell dumpsys window 2>&1 | Out-String
if ($xml -notmatch $Package) {
  # masked unlock path only if needed
  & $adb -s $Serial shell input keyevent KEYCODE_WAKEUP | Out-Null
  & $adb -s $Serial shell input keyevent 82 | Out-Null
  Start-Sleep -Seconds 1
  & $adb -s $Serial shell input text "0611" | Out-Null
  & $adb -s $Serial shell input keyevent 66 | Out-Null
  $unlockUsed = $true
  Start-Sleep -Seconds 2
  & $adb -s $Serial shell monkey -p $Package 1 | Out-Null
  Start-Sleep -Seconds 3
  & $adb -s $Serial shell input tap 270 2116
  Start-Sleep -Seconds 2
}
& $adb -s $Serial shell input swipe 540 1600 540 800 400 | Out-Null
Start-Sleep -Seconds 1
& $adb -s $Serial shell input tap 540 900 | Out-Null
Start-Sleep -Seconds 2
Capture "03_real_history_attempt"
@{
  device = $Serial
  readOnly = $true
  deviceUnlockPin = $(if ($unlockUsed) { 'DEVICE_UNLOCK_PIN_USED_MASKED' } else { 'NOT_USED' })
  at = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content (Join-Path $OutDir 'capture_manifest.json') -Encoding UTF8
