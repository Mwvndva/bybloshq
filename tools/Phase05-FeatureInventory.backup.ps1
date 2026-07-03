<#
    Phase05-FeatureInventory.ps1

    Generates the baseline inventories required for Phase 0.5
#>

$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path

$Output = Join-Path $Root "certification\phase-0\feature-analysis"

New-Item -ItemType Directory -Force -Path $Output | Out-Null

$SourceRoots = @()

if(Test-Path "$Root\src"){
    $SourceRoots += "$Root\src"
}

if(Test-Path "$Root\server"){
    $SourceRoots += "$Root\server"
}

if(Test-Path "$Root\android"){
    $SourceRoots += "$Root\android"
}

$ExcludeRegex = '\\node_modules\\|\\dist\\|\\build\\|\\coverage\\|\\\.git\\|\\\.gradle\\|\\certification\\|\\assets\\|\\public\\'

function Get-SourceFiles {

    param(
        [string[]]$Extensions
    )

    foreach($root in $SourceRoots){

        Get-ChildItem $root -Recurse -File -Include $Extensions |
        Where-Object {
            $_.FullName -notmatch $ExcludeRegex
        }

    }

}

############################################################
# ROUTES
############################################################

$routePatterns = @(
'<Route',
'createBrowserRouter',
'createRoutesFromElements',
'useRoutes',
'RouteObject'
)

Get-SourceFiles "*.ts","*.tsx","*.js","*.jsx" |
Select-String -Pattern $routePatterns |
ForEach-Object{

    [PSCustomObject]@{

        File=$_.Path.Replace($Root,'')
        Line=$_.LineNumber
        Match=$_.Matches.Value
        Code=$_.Line.Trim()

    }

} |
Export-Csv "$Output\RouteDefinitions.csv" -NoTypeInformation

############################################################
# BACKEND ENDPOINTS
############################################################

$apiPatterns=@(
'@Controller',
'@Get',
'@Post',
'@Put',
'@Delete',
'router\.',
'app\.use',
'fastify\.'
)

Get-SourceFiles "*.ts","*.js" |
Select-String -Pattern $apiPatterns |
ForEach-Object{

    [PSCustomObject]@{

        File=$_.Path.Replace($Root,'')
        Line=$_.LineNumber
        Match=$_.Matches.Value
        Code=$_.Line.Trim()

    }

} |
Export-Csv "$Output\ApiDefinitions.csv" -NoTypeInformation

############################################################
# PAGES
############################################################

Get-SourceFiles "*.tsx","*.jsx" |
Where-Object{

    $_.DirectoryName -match 'pages|views|screens'

} |
Select-Object @{

    Name="Page"

    Expression={$_.BaseName}

},@{

    Name="File"

    Expression={$_.FullName.Replace($Root,'')}

} |
Export-Csv "$Output\Pages.csv" -NoTypeInformation

############################################################
# COMPONENTS
############################################################

Get-SourceFiles "*.tsx","*.jsx" |
Where-Object{

    $_.DirectoryName -match 'components'

} |
Select-Object @{

    Name="Component"

    Expression={$_.BaseName}

},@{

    Name="File"

    Expression={$_.FullName.Replace($Root,'')}

} |
Export-Csv "$Output\Components.csv" -NoTypeInformation

############################################################
# HOOKS
############################################################

Get-SourceFiles "*.ts","*.tsx" |
Where-Object{

    $_.BaseName -match '^use[A-Z]'

} |
Select-Object @{

    Name="Hook"

    Expression={$_.BaseName}

},@{

    Name="File"

    Expression={$_.FullName.Replace($Root,'')}

} |
Export-Csv "$Output\Hooks.csv" -NoTypeInformation

############################################################
# CONTEXTS
############################################################

Get-SourceFiles "*.ts","*.tsx" |
Where-Object{

    $_.BaseName -match 'Context$'

} |
Select-Object @{

    Name="Context"

    Expression={$_.BaseName}

},@{

    Name="File"

    Expression={$_.FullName.Replace($Root,'')}

} |
Export-Csv "$Output\Contexts.csv" -NoTypeInformation

############################################################
# SERVICES
############################################################

Get-SourceFiles "*.ts","*.tsx" |
Where-Object{

    $_.BaseName -match 'Service$'

} |
Select-Object @{

    Name="Service"

    Expression={$_.BaseName}

},@{

    Name="File"

    Expression={$_.FullName.Replace($Root,'')}

} |
Export-Csv "$Output\Services.csv" -NoTypeInformation

############################################################
# AUTHENTICATION
############################################################

$authPatterns=@(
'ProtectedRoute',
'PrivateRoute',
'RequireAuth',
'useAuth',
'AuthContext',
'isAuthenticated',
'role',
'permission'
)

Get-SourceFiles "*.ts","*.tsx","*.js","*.jsx" |
Select-String -Pattern $authPatterns |
ForEach-Object{

    [PSCustomObject]@{

        File=$_.Path.Replace($Root,'')
        Line=$_.LineNumber
        Match=$_.Matches.Value
        Code=$_.Line.Trim()

    }

} |
Export-Csv "$Output\AuthAnalysis.csv" -NoTypeInformation

############################################################
# FEATURE KEYWORDS
############################################################

$keywords=@(
'login',
'register',
'auth',
'product',
'catalog',
'cart',
'checkout',
'payment',
'order',
'notification',
'dashboard',
'profile',
'admin',
'seller',
'buyer',
'search',
'review'
)

$featureResults=@()

foreach($k in $keywords){

    Get-SourceFiles "*.ts","*.tsx","*.js","*.jsx" |
    Select-String $k |
    ForEach-Object{

        $featureResults += [PSCustomObject]@{

            Feature=$k

            File=$_.Path.Replace($Root,'')

            Line=$_.LineNumber

            Code=$_.Line.Trim()

        }

    }

}

$featureResults |
Export-Csv "$Output\FeatureCandidates.csv" -NoTypeInformation

Write-Host ""
Write-Host "========================================"
Write-Host "Phase 0.5 Baseline Extraction Complete"
Write-Host "Output:"
Write-Host $Output
Write-Host "========================================"