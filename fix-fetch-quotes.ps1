# Fix missing opening quotes in fetchWithTokenRefresh calls
# Pattern: fetchWithTokenRefresh(/api/... should be fetchWithTokenRefresh('/api/...

$files = Get-ChildItem -Path "app" -Filter "*.tsx" -Recurse

$fixedCount = 0
$totalFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Fix pattern: fetchWithTokenRefresh(/api/ -> fetchWithTokenRefresh('/api/
    $content = $content -replace "fetchWithTokenRefresh\(/api/", "fetchWithTokenRefresh('/api/"
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixedCount++
        Write-Host "Fixed: $($file.FullName)" -ForegroundColor Green
    }
    $totalFiles++
}

Write-Host "`nTotal files scanned: $totalFiles" -ForegroundColor Cyan
Write-Host "Files fixed: $fixedCount" -ForegroundColor Green
