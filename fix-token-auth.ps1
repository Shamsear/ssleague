# PowerShell script to automatically fix token authentication in all dashboard pages
# This script adds fetchWithTokenRefresh import and replaces fetch calls

$dashboardPath = "C:\Drive d\SS\nosqltest\nextjs-project\app\dashboard"
$importLine = "import { fetchWithTokenRefresh } from '@/lib/token-refresh';"

# Get all .tsx files in dashboard
$files = Get-ChildItem -Path $dashboardPath -Filter "*.tsx" -Recurse

$filesModified = 0
$fetchCallsReplaced = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Skip if file already has fetchWithTokenRefresh import
    if ($content -match "fetchWithTokenRefresh") {
        Write-Host "✓ Skipping $($file.Name) - already has fetchWithTokenRefresh" -ForegroundColor Green
        continue
    }
    
    # Check if file has any await fetch( calls
    if ($content -match "await fetch\(") {
        Write-Host "Processing $($file.FullName)" -ForegroundColor Yellow
        
        # Add import after other imports
        if ($content -match "import.*from.*react") {
            # Find the last import statement
            $lines = $content -split "`n"
            $lastImportIndex = 0
            
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match "^import ") {
                    $lastImportIndex = $i
                }
            }
            
            # Insert the new import after the last import
            $lines = @(
                $lines[0..$lastImportIndex]
                $importLine
                $lines[($lastImportIndex + 1)..($lines.Count - 1)]
            )
            
            $content = $lines -join "`n"
            $modified = $true
        }
        
        # Replace await fetch( with await fetchWithTokenRefresh(
        # But NOT for /api/auth/set-token
        $originalContent = $content
        $pattern1 = 'await fetch\("(/api(?!/auth/set-token))'
        $replace1 = 'await fetchWithTokenRefresh("$1'
        $content = [regex]::Replace($content, $pattern1, $replace1)
        
        $pattern2 = "await fetch\('(/api(?!/auth/set-token))"
        $replace2 = "await fetchWithTokenRefresh('`$1"
        $content = [regex]::Replace($content, $pattern2, $replace2)
        
        $pattern3 = 'await fetch\(\s*`/api(?!/auth/set-token)'
        $replace3 = 'await fetchWithTokenRefresh(`/api'
        $content = [regex]::Replace($content, $pattern3, $replace3)
        
        if ($content -ne $originalContent) {
            $replacements = ([regex]::Matches($originalContent, "await fetch\(")).Count - ([regex]::Matches($content, "await fetch\(")).Count
            $fetchCallsReplaced += $replacements
            $modified = $true
            Write-Host "  ✓ Replaced $replacements fetch calls" -ForegroundColor Green
        }
        
        if ($modified) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            $filesModified++
            Write-Host "  ✓ File updated: $($file.Name)" -ForegroundColor Green
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "Files modified: $filesModified" -ForegroundColor Green
Write-Host "Fetch calls replaced: $fetchCallsReplaced" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
