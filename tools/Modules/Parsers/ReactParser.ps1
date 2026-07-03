# ==========================================================
# ReactParser.ps1
# Semantic React Analysis
# ==========================================================

function Extract-ReactComponents {

    param($File)

    #
    # function Component()
    #

    $matches = [regex]::Matches(
        $File.Content,
        '(?m)^\s*function\s+([A-Z][A-Za-z0-9_]*)\s*\('
    )

    foreach($match in $matches){

        $null = $File.ReactComponents.Add(
            $match.Groups[1].Value
        )

    }

    #
    # const Component = (...)
    #

    $matches = [regex]::Matches(
        $File.Content,
        '(?m)^\s*(const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*='
    )

    foreach($match in $matches){

        $null = $File.ReactComponents.Add(
            $match.Groups[2].Value
        )

    }

}

function Extract-Hooks {

    param($File)

    #
    # Built-in Hooks
    #

    $builtin = [regex]::Matches(
        $File.Content,
        '\b(useState|useEffect|useMemo|useCallback|useReducer|useContext|useRef|useLayoutEffect|useTransition|useDeferredValue|useId)\b'
    )

    foreach($hook in $builtin){

        $null = $File.Hooks.Add($hook.Value)

    }

    #
    # Custom Hooks
    #

    $custom = [regex]::Matches(
        $File.Content,
        '\b(use[A-Z][A-Za-z0-9_]*)\b'
    )

    foreach($hook in $custom){

        $null = $File.Hooks.Add($hook.Value)

    }

}