# ============================================
# FileScanner.ps1
# Repository Content Cache
# ============================================

$Global:FileCache = @{}

function Build-FileCache {

    param(
        [Parameter(Mandatory)]
        [System.Collections.IEnumerable]$Repository
    )

    Write-Status "Loading source files into memory..."

    $count = 0

    foreach($file in $Repository){

        try{

            $content = Get-Content $file.FullPath -Raw -ErrorAction Stop

            $Global:FileCache[$file.RelativePath] = [PSCustomObject]@{

    Metadata = $file

    Content = $content

    Lines = $content -split "`r?`n"

    Imports              = [System.Collections.Generic.HashSet[string]]::new()

    Exports              = [System.Collections.Generic.HashSet[string]]::new()

    ReactComponents      = [System.Collections.Generic.List[string]]::new()

    Hooks                = [System.Collections.Generic.HashSet[string]]::new()

    RouteDefinitions     = [System.Collections.Generic.List[object]]::new()

    ApiCalls             = [System.Collections.Generic.HashSet[string]]::new()

    SqlReferences        = [System.Collections.Generic.HashSet[string]]::new()

    EnvironmentVariables = [System.Collections.Generic.HashSet[string]]::new()

    Diagnostics          = [System.Collections.Generic.List[string]]::new()

    SemanticProcessed    = $false

}

            $count++

        }
        catch{

            Write-WarningStatus "Failed to read $($file.RelativePath)"

        }

    }

    Write-Success "$count files cached."

}

function Get-FileContent {

    param(
        [string]$RelativePath
    )

    return $Global:FileCache[$RelativePath]

}

function Get-Lines {

    param(
        [string]$RelativePath
    )

    return $Global:FileCache[$RelativePath].Lines

}

function Get-AllFiles {

    return $Global:FileCache.Values

}

function Get-RepositoryFile {

    param(
        [string]$RelativePath
    )

    return $Global:FileCache[$RelativePath]

}

function Get-FilesByExtension {

    param(
        [string]$Extension
    )

    return $Global:FileCache.Values |
        Where-Object {
            $_.Metadata.Extension -eq $Extension
        }

}