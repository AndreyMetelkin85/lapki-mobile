param(
    [string]$ApiUrl = 'http://10.0.2.2:8080/api/v3',
    [ValidateSet('x86_64', 'arm64-v8a', 'x86_64,arm64-v8a')]
    [string]$Architecture = 'x86_64'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactRoot = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
Push-Location -LiteralPath $projectRoot
try {
    docker build --file docker/Dockerfile.apk --target artifact --build-arg "API_BASE_URL=$ApiUrl" --build-arg "ANDROID_ARCH=$Architecture" --output "type=local,dest=$artifactRoot" .
    if ($LASTEXITCODE -ne 0) { throw 'Сборка APK завершилась с ошибкой.' }
    Get-Item -LiteralPath (Join-Path $artifactRoot 'lapki-android.apk') | Select-Object FullName,Length
} finally { Pop-Location }
