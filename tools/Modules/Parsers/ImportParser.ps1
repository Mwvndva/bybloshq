# ============================================================
# ImportParser.ps1
# ============================================================

function Extract-Imports {

    param($File)

    $imports = [regex]::Matches(
        $File.Content,
        '(?m)^\s*import\s+.*?from\s+["''](.+?)["'']'
    )

    foreach($match in $imports){

        $null = $File.Imports.Add(
            $match.Groups[1].Value
        )

    }

}