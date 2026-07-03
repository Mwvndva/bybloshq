# ============================================================
# SemanticReset.ps1
# Initializes semantic collections for a repository file
# ============================================================

function Reset-SemanticCollections {

    param(
        [Parameter(Mandatory)]
        $File
    )

    $File.Imports              = [System.Collections.Generic.HashSet[string]]::new()

    $File.Exports              = [System.Collections.Generic.HashSet[string]]::new()

    $File.ReactComponents      = [System.Collections.Generic.List[string]]::new()

    $File.Hooks                = [System.Collections.Generic.HashSet[string]]::new()

    $File.RouteDefinitions     = [System.Collections.Generic.List[object]]::new()

    $File.ApiCalls             = [System.Collections.Generic.HashSet[string]]::new()

    $File.SqlReferences        = [System.Collections.Generic.HashSet[string]]::new()

    $File.EnvironmentVariables = [System.Collections.Generic.HashSet[string]]::new()

    $File.Diagnostics          = [System.Collections.Generic.List[string]]::new()

    $File.SemanticProcessed    = $false

}