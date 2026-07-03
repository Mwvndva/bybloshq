# ==========================================================
# SymbolResolver.ps1
# Global Symbol Resolution
# ==========================================================

$Global:SymbolTable = @{}

function Build-SymbolTable {

    Write-Status "Building symbol table..."

    $Global:SymbolTable.Clear()

    foreach($file in $Global:FileCache.Values){

        foreach($export in $file.Exports){

            #
            # export default App
            #

            if($export -match '^export\s+default\s+([A-Za-z0-9_]+)$'){

                $name = $Matches[1]

                $Global:SymbolTable[$name] = [PSCustomObject]@{

                    Name = $name
                    Kind = "DefaultExport"
                    File = $file.Metadata.RelativePath
                    Module = $file

                }

                continue
            }

            #
            # export const routes
            #

            if($export -match '^export\s+(default\s+)?(function|class|const|interface|type)\s+([A-Za-z0-9_]+)'){

                $name = $Matches[3]

                $Global:SymbolTable[$name] = [PSCustomObject]@{

                    Name = $name
                    Kind = $Matches[2]
                    File = $file.Metadata.RelativePath
                    Module = $file

                }

            }

        }

    }

    Write-Success "$($Global:SymbolTable.Count) symbols indexed."

}

function Resolve-Symbol {

    param(
        [string]$Name
    )

    if($Global:SymbolTable.ContainsKey($Name)){
        return $Global:SymbolTable[$Name]
    }

    return $null

}