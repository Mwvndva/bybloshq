function Invoke-AnalysisPipeline {

    Write-Status "Starting analysis pipeline..."

    #
    # Stage 1
    #

    $Repository = Build-RepositoryIndex

    #
    # Stage 2
    #

    Build-FileCache $Repository

    #
    # Stage 3
    #

    Invoke-SemanticExtraction

    #
    # Stage 4
    #

    Build-SymbolTable

    Build-DependencyGraph
    
    Resolve-Imports

    Export-DependencyGraph

    Export-RepositoryData

Write-Success "Analysis pipeline completed."

    return $Repository

}