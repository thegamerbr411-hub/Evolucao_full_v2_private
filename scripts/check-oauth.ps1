param(
  [string]$Root = "f:\projetos\evolucao app"
)

$ErrorActionPreference = "Stop"

$appJsonPath = Join-Path $Root "app.json"
$gsPath = Join-Path $Root "android\app\google-services.json"
$manifestPath = Join-Path $Root "android\app\src\main\AndroidManifest.xml"

foreach ($p in @($appJsonPath, $gsPath, $manifestPath)) {
  if (-not (Test-Path $p)) {
    Write-Error "Arquivo obrigatorio ausente: $p"
    exit 1
  }
}

$appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
$gs = Get-Content $gsPath -Raw | ConvertFrom-Json
$manifest = Get-Content $manifestPath -Raw

$packageApp = [string]$appJson.expo.android.package
$schemeApp = [string]$appJson.expo.scheme
$client = $gs.client[0]
$packageGs = [string]$client.client_info.android_client_info.package_name
$oauthClients = @($client.oauth_client)
$androidClient = $oauthClients | Where-Object { $_.client_type -eq 1 } | Select-Object -First 1
$webClient = $oauthClients | Where-Object { $_.client_type -eq 3 } | Select-Object -First 1

$fail = @()

if ([string]::IsNullOrWhiteSpace($packageApp)) { $fail += "package ausente em app.json" }
if ([string]::IsNullOrWhiteSpace($schemeApp)) { $fail += "scheme ausente em app.json" }
if ($packageApp -ne $packageGs) { $fail += "package diverge entre app.json e google-services.json" }
if (-not $androidClient) { $fail += "android oauth client (type 1) ausente" }
if (-not $webClient) { $fail += "web oauth client (type 3) ausente" }
$schemeAppPattern = 'android:scheme="' + [regex]::Escape($schemeApp) + '"'
if ($manifest -notmatch $schemeAppPattern) { $fail += "scheme do app nao encontrado no AndroidManifest" }
if ($manifest -notmatch "com\.googleusercontent\.apps\.") { $fail += "scheme googleusercontent nao encontrado no AndroidManifest" }

if ($androidClient) {
  $androidClientId = [string]$androidClient.client_id
  $prefix = $androidClientId -replace "\.apps\.googleusercontent\.com$", ""
  if ([string]::IsNullOrWhiteSpace($prefix)) {
    $fail += "nao foi possivel derivar prefixo do android client id"
  } else {
    $expectedScheme = "com.googleusercontent.apps.$prefix"
    $expectedSchemePattern = 'android:scheme="' + [regex]::Escape($expectedScheme) + '"'
    if ($manifest -notmatch $expectedSchemePattern) {
      $fail += "AndroidManifest nao contem scheme esperado $expectedScheme"
    }
    $expectedRedirect = "${expectedScheme}:/oauthredirect"
    Write-Host "[INFO] redirect esperado Android: $expectedRedirect"
  }
}

Write-Host "[INFO] package: $packageApp"
Write-Host "[INFO] scheme: $schemeApp"
Write-Host "[INFO] android client: $($androidClient.client_id)"
Write-Host "[INFO] web client: $($webClient.client_id)"

if ($fail.Count -gt 0) {
  Write-Host ""
  Write-Host "Falhas OAuth:" -ForegroundColor Red
  $fail | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

Write-Host ""
Write-Host "check-oauth: PASS" -ForegroundColor Green
exit 0
