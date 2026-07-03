# ============================================================
# ExportParser.ps1
# ============================================================

function Extract-Exports {

    param($File)

    $exports = [regex]::Matches(
        $File.Content,
        '(?m)^\s*export\s+(default\s+)?(function|class|const|interface|type)?\s*([A-Za-z0-9_]+)?'
    )

    foreach($match in $exports){

        $value = $match.Value.Trim()

        if($value.Length -gt 0){

            $null = $File.Exports.Add($value)

        }

    }

}