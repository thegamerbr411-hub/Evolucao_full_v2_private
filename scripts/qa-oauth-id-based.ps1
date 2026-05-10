Set-Location "F:\projetos\evolucao app"

function Get-CenterFromRegexMatch($match) {
  $x1 = [int]$match.Groups[1].Value
  $y1 = [int]$match.Groups[2].Value
  $x2 = [int]$match.Groups[3].Value
  $y2 = [int]$match.Groups[4].Value
  $x = [int](($x1 + $x2) / 2)
  $y = [int](($y1 + $y2) / 2)
  return @{ x = $x; y = $y }
}

adb shell am start -n com.tipolt.evolucaofullv2/.MainActivity | Out-Null
Start-Sleep -Seconds 3

adb shell uiautomator dump /sdcard/ui_start.xml | Out-Null
adb pull /sdcard/ui_start.xml "$env:TEMP\ui_start.xml" | Out-Null
$xml = Get-Content "$env:TEMP\ui_start.xml" -Raw

$tabPerfil = [regex]::Match($xml, 'resource-id="tab-perfil"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $tabPerfil.Success) {
  adb shell screencap /sdcard/fail_tab_perfil_not_found.png | Out-Null
  adb pull /sdcard/fail_tab_perfil_not_found.png "$PWD/screenshots/fail_tab_perfil_not_found.png" | Out-Null
  Write-Host "FAIL_TAB_PERFIL_NOT_FOUND"
  exit 0
}

$tabCenter = Get-CenterFromRegexMatch $tabPerfil
adb shell input tap $tabCenter.x $tabCenter.y
Start-Sleep -Seconds 2

# scroll to account section
adb shell input swipe 540 1600 540 800
Start-Sleep -Seconds 1
adb shell input swipe 540 1600 540 800
Start-Sleep -Seconds 1

adb shell uiautomator dump /sdcard/ui_profile.xml | Out-Null
adb pull /sdcard/ui_profile.xml "$env:TEMP\ui_profile.xml" | Out-Null
$xml2 = Get-Content "$env:TEMP\ui_profile.xml" -Raw

$google = [regex]::Match($xml2, 'resource-id="btn_google_login"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $google.Success) {
  adb shell input swipe 540 1200 540 1800
  Start-Sleep -Seconds 1
  adb shell uiautomator dump /sdcard/ui_profile2.xml | Out-Null
  adb pull /sdcard/ui_profile2.xml "$env:TEMP\ui_profile2.xml" | Out-Null
  $xml3 = Get-Content "$env:TEMP\ui_profile2.xml" -Raw
  $google = [regex]::Match($xml3, 'resource-id="btn_google_login"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
}

if (-not $google.Success) {
  adb shell screencap /sdcard/fail_google_button_not_found.png | Out-Null
  adb pull /sdcard/fail_google_button_not_found.png "$PWD/screenshots/fail_google_button_not_found.png" | Out-Null
  Write-Host "FAIL_GOOGLE_BUTTON_NOT_FOUND"
  exit 0
}

$googleCenter = Get-CenterFromRegexMatch $google
adb shell input tap $googleCenter.x $googleCenter.y
Start-Sleep -Seconds 6
adb shell screencap /sdcard/oauth_result_id_based.png | Out-Null
adb pull /sdcard/oauth_result_id_based.png "$PWD/screenshots/oauth_result_id_based.png" | Out-Null
Write-Host "SUCCESS_TAP_GOOGLE_AT $($googleCenter.x),$($googleCenter.y)"
