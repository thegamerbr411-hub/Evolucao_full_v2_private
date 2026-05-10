Set-Location "F:\projetos\evolucao app"

adb shell am start -n com.tipolt.evolucaofullv2/.MainActivity | Out-Null
Start-Sleep -Seconds 4

adb shell uiautomator dump /sdcard/ui.xml | Out-Null
adb pull /sdcard/ui.xml "$env:TEMP\tevo_ui.xml" | Out-Null
$xml = Get-Content "$env:TEMP\tevo_ui.xml" -Raw

$tab = [regex]::Match($xml, 'text="Perfil"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $tab.Success) {
  adb shell screencap /sdcard/tab_perfil_not_found.png | Out-Null
  adb pull /sdcard/tab_perfil_not_found.png "$PWD/screenshots/tab_perfil_not_found.png" | Out-Null
  Write-Host "PERFIL_TAB_NOT_FOUND"
  exit 0
}

$x = [int](($tab.Groups[1].Value + $tab.Groups[3].Value) / 2)
$y = [int](($tab.Groups[2].Value + $tab.Groups[4].Value) / 2)
adb shell input tap $x $y
Start-Sleep -Seconds 2

adb shell uiautomator dump /sdcard/ui2.xml | Out-Null
adb pull /sdcard/ui2.xml "$env:TEMP\tevo_ui2.xml" | Out-Null
$xml2 = Get-Content "$env:TEMP\tevo_ui2.xml" -Raw

$google = [regex]::Match($xml2, 'resource-id="btn_google_login"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if (-not $google.Success) {
  adb shell input swipe 540 1700 540 500
  Start-Sleep -Seconds 2
  adb shell uiautomator dump /sdcard/ui3.xml | Out-Null
  adb pull /sdcard/ui3.xml "$env:TEMP\tevo_ui3.xml" | Out-Null
  $xml3 = Get-Content "$env:TEMP\tevo_ui3.xml" -Raw
  $google = [regex]::Match($xml3, 'resource-id="btn_google_login"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
}

if (-not $google.Success) {
  adb shell screencap /sdcard/profile_no_google_visible.png | Out-Null
  adb pull /sdcard/profile_no_google_visible.png "$PWD/screenshots/profile_no_google_visible.png" | Out-Null
  Write-Host "GOOGLE_BUTTON_NOT_FOUND"
  exit 0
}

$gx = [int](($google.Groups[1].Value + $google.Groups[3].Value) / 2)
$gy = [int](($google.Groups[2].Value + $google.Groups[4].Value) / 2)
adb shell input tap $gx $gy
Start-Sleep -Seconds 4
adb shell screencap /sdcard/oauth_state_after_tap.png | Out-Null
adb pull /sdcard/oauth_state_after_tap.png "$PWD/screenshots/oauth_state_after_tap.png" | Out-Null
Write-Host "GOOGLE_TAPPED_AND_CAPTURED"
