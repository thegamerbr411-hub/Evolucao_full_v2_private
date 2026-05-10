Set-Location "F:\projetos\evolucao app"

$tabs = @(
  @{ id = 'tab-home'; name = 'home' },
  @{ id = 'tab-treino'; name = 'treino' },
  @{ id = 'tab-nutricao'; name = 'nutricao' },
  @{ id = 'tab-conversa'; name = 'coach' },
  @{ id = 'tab-social'; name = 'social' },
  @{ id = 'tab-perfil'; name = 'perfil' }
)

adb shell am start -n com.tipolt.evolucaofullv2/.MainActivity | Out-Null
Start-Sleep -Seconds 3

foreach ($tab in $tabs) {
  adb shell uiautomator dump /sdcard/ui_tabs.xml | Out-Null
  adb pull /sdcard/ui_tabs.xml "$env:TEMP\ui_tabs.xml" | Out-Null
  $xml = Get-Content "$env:TEMP\ui_tabs.xml" -Raw

  $m = [regex]::Match($xml, ('resource-id="' + [regex]::Escape($tab.id) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'))
  if ($m.Success) {
    $x = [int](($m.Groups[1].Value + $m.Groups[3].Value) / 2)
    $y = [int](($m.Groups[2].Value + $m.Groups[4].Value) / 2)
    adb shell input tap $x $y
    Start-Sleep -Seconds 2
    adb shell screencap "/sdcard/tab_$($tab.name).png" | Out-Null
    adb pull "/sdcard/tab_$($tab.name).png" "$PWD/screenshots/tab_$($tab.name).png" | Out-Null
    Write-Host "CAPTURED_$($tab.name.ToUpper())"
  } else {
    Write-Host "TAB_NOT_FOUND_$($tab.name.ToUpper())"
  }
}
