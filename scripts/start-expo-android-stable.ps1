$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Evita OOM no Metro em projetos grandes no Node 24+
$env:NODE_OPTIONS = '--max-old-space-size=8192'

$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$platformTools = Join-Path $sdkRoot 'platform-tools'
if (Test-Path $platformTools) {
  if (($env:Path -split ';') -notcontains $platformTools) {
    $env:Path = "$platformTools;$env:Path"
  }
}

Write-Host '[expo-stable] NODE_OPTIONS=' $env:NODE_OPTIONS
Write-Host '[expo-stable] iniciando Expo Android...'

npx expo start --android
