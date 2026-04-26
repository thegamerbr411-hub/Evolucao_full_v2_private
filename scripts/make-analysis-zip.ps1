param(
  [string]$OutputZip = "analysis-clean.zip"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StagingDir = Join-Path $ProjectRoot ".analysis_zip_staging"
$OutputPath = Join-Path $ProjectRoot $OutputZip

$includeFiles = @(
  "App.js",
  "app.json",
  "index.js",
  "package.json",
  "babel.config.js",
  "metro.config.js",
  "eas.json",
  "tsconfig.json",
  "firestore.rules",
  "README.md",
  "README_ANALYSIS.md"
)

$includeDirs = @(
  "src",
  "dashboard",
  "e2e",
  "qa",
  "scripts",
  "analysis",
  "backend"
)

$excludeDirNames = @(
  "node_modules",
  "android",
  "ios",
  "build",
  "dist",
  "dist_clean_project",
  "artifacts",
  ".git",
  ".expo",
  ".gradle",
  "coverage",
  "_export_zip",
  "_audit_release"
)

$allowedExt = @(
  ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".yml", ".yaml", ".ps1", ".sh", ".rules", ".xml"
)

function New-CleanDir([string]$Path) {
  if (Test-Path $Path) {
    Remove-Item -Path $Path -Recurse -Force
  }
  New-Item -Path $Path -ItemType Directory | Out-Null
}

function Ensure-Parent([string]$TargetPath) {
  $parent = Split-Path -Path $TargetPath -Parent
  if (-not (Test-Path $parent)) {
    New-Item -Path $parent -ItemType Directory -Force | Out-Null
  }
}

function Should-ExcludeDirectory([string]$FullPath) {
  foreach ($name in $excludeDirNames) {
    if ($FullPath -match "(^|\\)$([Regex]::Escape($name))(\\|$)") {
      return $true
    }
  }
  return $false
}

function Copy-FileIfAllowed([string]$SourceFile, [string]$DestRoot) {
  $ext = [IO.Path]::GetExtension($SourceFile).ToLowerInvariant()
  if (-not $allowedExt.Contains($ext)) {
    return
  }

  $relative = $SourceFile.Substring($ProjectRoot.Path.Length).TrimStart('\\')
  $target = Join-Path $DestRoot $relative
  Ensure-Parent -TargetPath $target
  Copy-Item -Path $SourceFile -Destination $target -Force
}

function Copy-DirectoryFiltered([string]$SourceDir, [string]$DestRoot) {
  if (-not (Test-Path $SourceDir)) {
    return
  }

  Get-ChildItem -Path $SourceDir -Recurse -File | ForEach-Object {
    if (Should-ExcludeDirectory -FullPath $_.FullName) {
      return
    }
    Copy-FileIfAllowed -SourceFile $_.FullName -DestRoot $DestRoot
  }
}

New-CleanDir -Path $StagingDir

foreach ($file in $includeFiles) {
  $full = Join-Path $ProjectRoot $file
  if (Test-Path $full) {
    Copy-FileIfAllowed -SourceFile (Resolve-Path $full) -DestRoot $StagingDir
  }
}

foreach ($dir in $includeDirs) {
  $full = Join-Path $ProjectRoot $dir
  if (Test-Path $full) {
    Copy-DirectoryFiltered -SourceDir $full -DestRoot $StagingDir
  }
}

if (Test-Path $OutputPath) {
  Remove-Item -Path $OutputPath -Force
}

Compress-Archive -Path (Join-Path $StagingDir "*") -DestinationPath $OutputPath -CompressionLevel Optimal

if (Test-Path $StagingDir) {
  Remove-Item -Path $StagingDir -Recurse -Force
}

$sizeMb = [Math]::Round((Get-Item $OutputPath).Length / 1MB, 2)
Write-Host "analysis-clean.zip generated: $OutputPath"
Write-Host "size: $sizeMb MB"
