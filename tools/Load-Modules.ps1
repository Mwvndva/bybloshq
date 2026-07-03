# ============================================================
# Load-Modules.ps1
# Loads every module required by the repository analyzer
# ============================================================

$ModuleRoot = Join-Path $PSScriptRoot "Modules"

Write-Host ""
Write-Host "Loading Byblos modules..."
Write-Host ""

#
# Core modules
#

. "$ModuleRoot\Common.ps1"
. "$ModuleRoot\RepositoryIndexer.ps1"
. "$ModuleRoot\FileScanner.ps1"
. "$ModuleRoot\CsvWriter.ps1"
. "$ModuleRoot\GraphBuilder.ps1"

#
# Parsers
#

Get-ChildItem "$ModuleRoot\Parsers\*.ps1" |
Sort-Object Name |
ForEach-Object {

    . $_.FullName

}

#
# Resolvers
#

Get-ChildItem "$ModuleRoot\Resolvers\*.ps1" |
Sort-Object Name |
ForEach-Object {

    . $_.FullName

}

#
# Exporters
#

Get-ChildItem "$ModuleRoot\Exporters\*.ps1" |
Sort-Object Name |
ForEach-Object {

    . $_.FullName

}


#
# Graph
#

Get-ChildItem "$ModuleRoot\Graph\*.ps1" |
Sort-Object Name |
ForEach-Object {

    . $_.FullName

}

#
# Pipelines
#

if(Test-Path "$ModuleRoot\Pipeline"){

    Get-ChildItem "$ModuleRoot\Pipeline\*.ps1" |
    Sort-Object Name |
    ForEach-Object {

        . $_.FullName

    }

}

#
# Helpers (optional)
#

if(Test-Path "$ModuleRoot\Helpers"){

    Get-ChildItem "$ModuleRoot\Helpers\*.ps1" |
    Sort-Object Name |
    ForEach-Object {

        . $_.FullName

    }

}

#
# Semantic orchestrator
#

. "$ModuleRoot\SemanticExtractor.ps1"

Write-Host ""
Write-Host "All modules loaded."
Write-Host ""