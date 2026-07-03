# ==========================================================
# DependencyGraph.ps1
# Repository Dependency Graph
# ==========================================================

#
# Global graph
#

$Global:DependencyGraph = @{

    Nodes = @{}

    Edges = [System.Collections.Generic.List[object]]::new()

}

# ==========================================================
# Reset Graph
# ==========================================================

function Reset-DependencyGraph {

    $Global:DependencyGraph.Nodes.Clear()

    $Global:DependencyGraph.Edges.Clear()

}

# ==========================================================
# Build Nodes
# ==========================================================

function Build-DependencyNodes {

    Write-Status "Building dependency nodes..."

    foreach($file in Get-AllFiles){

        $Global:DependencyGraph.Nodes[
            $file.Metadata.RelativePath
        ] = $file

    }

    Write-Success "$($Global:DependencyGraph.Nodes.Count) nodes created."

}

# ==========================================================
# Build Import Edges
# ==========================================================

function Build-DependencyEdges {

    Write-Status "Building dependency edges..."

    foreach($file in Get-AllFiles){

        foreach($import in $file.Imports){

            $Global:DependencyGraph.Edges.Add(

                [PSCustomObject]@{

                    From = $file.Metadata.RelativePath

                    To = $import

                    Type = "Import"

                    Resolved = $false

                }

            )

        }

    }

    Write-Success "$($Global:DependencyGraph.Edges.Count) edges created."

}

# ==========================================================
# Build Graph
# ==========================================================

function Build-DependencyGraph {

    Write-Status "Building dependency graph..."

    Reset-DependencyGraph

    Build-DependencyNodes

    Build-DependencyEdges

    Write-Success "Dependency graph completed."

}

# ==========================================================
# Query Helpers
# ==========================================================

function Get-DependencyNode {

    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    return $Global:DependencyGraph.Nodes[$Path]

}

function Get-DependencyEdges {

    return $Global:DependencyGraph.Edges

}

function Get-OutboundDependencies {

    param(
        [Parameter(Mandatory)]
        [string]$RelativePath
    )

    return $Global:DependencyGraph.Edges |
        Where-Object {

            $_.From -eq $RelativePath

        }

}

function Get-InboundDependencies {

    param(
        [Parameter(Mandatory)]
        [string]$ImportName
    )

    return $Global:DependencyGraph.Edges |
        Where-Object {

            $_.To -eq $ImportName

        }

}

# ==========================================================
# Export Graph
# ==========================================================

function Export-DependencyGraph {

    Write-Status "Exporting dependency graph..."

    $Global:DependencyGraph.Edges |
        Export-Csv `
            (Join-Path $Global:CacheOutput "DependencyGraph.csv") `
            -NoTypeInformation

    $Global:DependencyGraph.Edges |
        ConvertTo-Json -Depth 10 |
        Set-Content `
            (Join-Path $Global:CacheOutput "DependencyGraph.json")

    Write-Success "Dependency graph exported."

}