# PowerShell script to remove buyer console.log statements
$file = "c:\Users\Administrator\Downloads\bybloshq\src\api\buyerApi.ts"
$content = Get-Content $file -Raw

# Remove sensitive token logs
$content = $content -replace "console\.log\('Sending request with token:', token\.substring\(0, 10\) \+ '\.\.\.'\);", "// Removed sensitive token log"
$content = $content -replace "console\.log\('Token stored in localStorage:', storedToken \? 'Yes' : 'No'\);", "// Removed token storage log"

Set-Content $file -Value $content

Write-Host "Removed sensitive console.log statements from buyerApi.ts"
