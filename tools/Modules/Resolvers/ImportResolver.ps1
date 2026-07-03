# ==========================================================
# ImportResolver.ps1
# Import Resolution Engine
# ==========================================================

function Resolve-Imports {

    Write-Status "Resolving imports..."

    $resolved = 0
    $unresolved = 0

    foreach($edge in $Global:DependencyGraph.Edges){

        #
        # Resolution logic goes here
        #

    }

    Write-Success "$resolved imports resolved."

    Write-Status "$unresolved imports unresolved."

}