param(
  [string]$Device = "RQ8T209ZTAF",
  [string]$OutRoot = "F:\projetos\evolucao app\recovery_audit\final_device"
)

$ErrorActionPreference = "Stop"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$pkg = "com.tipolt.evolucaofullv2"
$activity = "$pkg/.MainActivity"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $OutRoot "video_check_$ts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Tap([int]$x, [int]$y, [int]$waitMs = 1200) {
  & $adb -s $Device shell input tap $x $y | Out-Null
  Start-Sleep -Milliseconds $waitMs
}
function Press-Back([int]$waitMs = 1000) {
  & $adb -s $Device shell input keyevent 4 | Out-Null
  Start-Sleep -Milliseconds $waitMs
}
function Dump-Xml() {
  $remote = "/sdcard/window_dump_video_check.xml"
  $local = Join-Path $outDir "window_dump.xml"
  & $adb -s $Device shell uiautomator dump $remote | Out-Null
  & $adb -s $Device pull $remote $local | Out-Null
  return Get-Content $local -Raw
}
function Get-BoundsCenterByText([string]$xmlRaw, [string]$text) {
  $esc = [Regex]::Escape($text)
  $pattern = 'text="' + $esc + '"[\s\S]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
  $m = [regex]::Match($xmlRaw, $pattern)
  if (-not $m.Success) { return $null }
  return @{ X = [int](($m.Groups[1].Value + $m.Groups[3].Value) / 2); Y = [int](($m.Groups[2].Value + $m.Groups[4].Value) / 2) }
}
function Tap-ByText([string]$text, [int]$waitMs = 1800) {
  $raw = Dump-Xml
  $pos = Get-BoundsCenterByText -xmlRaw $raw -text $text
  if ($null -eq $pos) { return $false }
  Tap -x $pos.X -y $pos.Y -waitMs $waitMs
  return $true
}

& $adb -s $Device shell am start -n $activity | Out-Null
Start-Sleep -Seconds 4
Tap 270 2137 2200
Tap 540 1537 3500
Tap 540 1400 2200

$foundExternal = $false
$foundInternal = $false
if (Tap-ByText "Abrir video (estável)" 3500) {
  $foundExternal = $true
  Press-Back 1500
}
if (Tap-ByText "Tentar player interno (beta)" 4500) {
  $foundInternal = $true
}

"foundExternal=$foundExternal" | Set-Content (Join-Path $outDir "summary.txt")
Add-Content (Join-Path $outDir "summary.txt") "foundInternal=$foundInternal"
Write-Output "VIDEO_VALIDATION_DONE outDir=$outDir external=$foundExternal internal=$foundInternal"
