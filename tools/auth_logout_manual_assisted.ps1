<#
.SYNOPSIS
  Hybrid logout validation — capture + storage only. No scroll automation.
#>
param(
  [ValidateSet('before', 'after', 'reopen')]
  [string]$Phase = 'before',
  [string]$Serial = 'emulator-5554',
  [string]$SessionDir = ''
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($SessionDir)) {
  $SessionDir = Join-Path $RepoRoot 'qa\ultra_audit_sessions\20260529_auth_final\auth_final_runtime\logout_manual_assisted'
}
New-Item -ItemType Directory -Force -Path $SessionDir | Out-Null

$stepMap = @{
  before = '01_before_manual_logout'
  after  = '02_after_manual_logout'
  reopen = '03_after_force_stop_reopen'
}
$storageMap = @{
  before = '01_storage_before_logout.txt'
  after  = '02_storage_after_logout.txt'
  reopen = '03_storage_after_reopen.txt'
}

$step = $stepMap[$Phase]
& (Join-Path $PSScriptRoot 'auth_manual_capture.ps1') -Step $step -Serial $Serial -SessionDir $SessionDir -LogcatPattern 'AUTH|logout|clear_user_identity|Firebase|login|Cadastro'

$storageOut = Join-Path $SessionDir $storageMap[$Phase]
$inspect = Join-Path $RepoRoot 'qa\ultra_audit_sessions\20260529_auth_final\storage_inspect.py'
python $inspect $Serial $storageOut 2>$null | Out-Null

$xmlPath = Join-Path $SessionDir ($step + '.xml')
$xml = if (Test-Path $xmlPath) { Get-Content $xmlPath -Raw } else { '' }
$screen = if ($xml -match 'screen_login|input_email|Cadastrar') { 'Login' }
          elseif ($xml -match 'screen_home|tab_home') { 'Home' }
          else { 'Other' }

Write-Host "PHASE=$Phase SCREEN=$screen SESSION=$SessionDir"
@{ phase = $Phase; screen = $screen; sessionDir = $SessionDir } | ConvertTo-Json
