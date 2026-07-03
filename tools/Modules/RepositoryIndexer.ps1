function Build-RepositoryIndex {

    Write-Status "Building repository index..."

    $sourceRoots = @(
        (Join-Path $Global:RepositoryRoot "src"),
        (Join-Path $Global:RepositoryRoot "server\src"),
        (Join-Path $Global:RepositoryRoot "server\migrations"),
        (Join-Path $Global:RepositoryRoot "server\scripts"),
        (Join-Path $Global:RepositoryRoot "android\app\src")
    )

    $files = New-Object System.Collections.Generic.List[Object]

    foreach($root in $sourceRoots){

        if(!(Test-Path $root)){
            continue
        }

        Write-Status "Scanning $root"

        Get-ChildItem $root -Recurse -File |
        Where-Object {

            $extension = $_.Extension.ToLower()

            $Global:SourceExtensions -contains $extension

        } |
        ForEach-Object {

            $files.Add([PSCustomObject]@{

                Name = $_.Name
                BaseName = $_.BaseName
                Extension = $_.Extension
                Directory = Normalize-Path $_.DirectoryName
                RelativePath = Normalize-Path $_.FullName
                FullPath = $_.FullName
                Length = $_.Length
                LastWriteTime = $_.LastWriteTime

            })

        }

    }

    Write-Success "$($files.Count) source files indexed."

$files |
Export-Csv `
(Join-Path $Global:CacheOutput "RepositoryIndex.csv") `
-NoTypeInformation

$files |
ConvertTo-Json -Depth 5 |
Set-Content `
(Join-Path $Global:CacheOutput "RepositoryIndex.json")

Write-Success "Repository index exported."

return $files

}