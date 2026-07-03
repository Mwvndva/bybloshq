# ============================================================
# SemanticExtractor.ps1
# Repository Semantic Extraction Engine
# ============================================================



function Invoke-SemanticExtraction {

    Write-Status "Performing semantic extraction..."

    $processed = 0
    $skipped = 0

 foreach($file in Get-AllFiles){

    if($null -eq $file){
        $skipped++
        continue
    }

    if([string]::IsNullOrWhiteSpace($file.Content)){
        $skipped++
        continue
    }

    if($file.SemanticProcessed){
        continue
    }

    Reset-SemanticCollections $file

    Extract-Imports $file
    Extract-Exports $file
    Extract-ReactComponents $file
    Extract-Hooks $file
    Extract-Routes $file
    Extract-ApiCalls $file
    Extract-SqlReferences $file
    Extract-EnvironmentVariables $file

    $file.SemanticProcessed = $true

    $processed++
}

    Write-Success "$processed files processed."
    Write-Status "$skipped files skipped."

}