Set-StrictMode -Version Latest

$Global:RepositoryRoot = Split-Path $PSScriptRoot -Parent | Split-Path -Parent

$Global:OutputRoot = Join-Path $Global:RepositoryRoot "certification\repository-analysis"

$Global:CsvOutput = Join-Path $Global:OutputRoot "csv"

$Global:GraphOutput = Join-Path $Global:OutputRoot "graphs"

$Global:CacheOutput = Join-Path $Global:OutputRoot "cache"

$Global:LogOutput = Join-Path $Global:OutputRoot "logs"

$Global:ExcludedDirectories = @(
    "node_modules",
    "dist",
    "build",
    ".git",
    ".gradle",
    "coverage",
    "certification",
    "public",
    "assets",
    "uploads",
    "email-templates",
    "test"
)

$Global:SourceExtensions = @(
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".sql"
)

function Write-Status {

    param([string]$Message)

    Write-Host "[INFO] $Message" -ForegroundColor Cyan

}

function Write-WarningStatus {

    param([string]$Message)

    Write-Host "[WARN] $Message" -ForegroundColor Yellow

}

function Write-Success {

    param([string]$Message)

    Write-Host "[ OK ] $Message" -ForegroundColor Green

}

function Normalize-Path {

    param([string]$Path)

    return $Path.Replace($Global:RepositoryRoot,"").TrimStart("\")

}