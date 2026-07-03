# ==========================================================
# RouteParser.ps1
# Semantic Route Extraction
# ==========================================================

function Extract-Routes {

    param($File)

    #
    # Object routes
    # Example:
    # {
    #     path: "/login",
    #     element: <Login />
    # }
    #

    $matches = [regex]::Matches(
        $File.Content,
        '(?s)path\s*:\s*["'']([^"'']+)["''].*?element\s*:\s*<([A-Za-z0-9_\.]+)'
    )

    foreach($match in $matches){

        $File.RouteDefinitions.Add(

            [PSCustomObject]@{

                Path       = $match.Groups[1].Value
                Component  = $match.Groups[2].Value
                Type       = "ObjectRoute"
                Dynamic    = $match.Groups[1].Value.Contains(":")
                Wildcard   = ($match.Groups[1].Value -eq "*")
                SourceFile = $File.Metadata.RelativePath

            }

        )

    }

    #
    # JSX routes
    # <Route path="/login" element={<Login />} />
    #

    $matches = [regex]::Matches(
        $File.Content,
        '<Route[^>]*path=["'']([^"'']+)["''][^>]*element=\{<([A-Za-z0-9_\.]+)'
    )

    foreach($match in $matches){

        $File.RouteDefinitions.Add(

            [PSCustomObject]@{

                Path       = $match.Groups[1].Value
                Component  = $match.Groups[2].Value
                Type       = "JSXRoute"
                Dynamic    = $match.Groups[1].Value.Contains(":")
                Wildcard   = ($match.Groups[1].Value -eq "*")
                SourceFile = $File.Metadata.RelativePath

            }

        )

    }

}