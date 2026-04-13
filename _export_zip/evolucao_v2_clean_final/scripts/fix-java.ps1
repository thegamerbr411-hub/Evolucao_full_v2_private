$ErrorActionPreference = 'Stop'

function Find-Java17Home {
  $candidates = @(
    'C:\Program Files\Eclipse Adoptium\jdk-17',
    'C:\Program Files\Java\jdk-17'
  )

  $dynamicRoots = @(
    'C:\Program Files\Eclipse Adoptium',
    'C:\Program Files\Java'
  )

  foreach ($root in $dynamicRoots) {
    if (Test-Path $root) {
      Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'jdk-17*' } |
        ForEach-Object {
          $candidates += $_.FullName
        }
    }
  }

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate 'bin\java.exe')) {
      return $candidate
    }
  }

  return $null
}

$javaHome = Find-Java17Home

if (-not $javaHome) {
  Write-Host 'Java 17 nao encontrado.'
  Write-Host 'Instale em: https://adoptium.net/ (Temurin 17 x64).'
  exit 1
}

$env:JAVA_HOME = $javaHome
if (($env:Path -split ';') -notcontains "$javaHome\bin") {
  $env:Path = "$javaHome\bin;$env:Path"
}

Write-Host "JAVA_HOME da sessao: $env:JAVA_HOME"
java -version