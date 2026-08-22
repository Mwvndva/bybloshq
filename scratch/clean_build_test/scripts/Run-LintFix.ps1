param(
    [Parameter(Mandatory)]
    [string]$Module
)

$script = ".\scripts\lint-fixes\$Module.ps1"

if (!(Test-Path $script)) {
    Write-Host "Module '$Module' not found." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Running $Module fixes..." -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Cyan

& $script

Write-Host ""
Write-Host "Running ESLint..." -ForegroundColor Green
npm run lint

Write-Host ""
Write-Host "Running TypeScript..." -ForegroundColor Green
npx tsc --noEmit