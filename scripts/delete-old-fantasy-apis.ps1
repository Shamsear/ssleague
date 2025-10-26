# Delete Old Fantasy APIs That Haven't Been Migrated
# These APIs are still using Firebase and should be removed
# since the core features (Phases 1-4) are now in PostgreSQL

Write-Host "`n🗑️  Deleting Old Unmigrated Fantasy APIs..." -ForegroundColor Red
Write-Host "=" * 60 -ForegroundColor Gray

$apiPath = "C:\Drive d\SS\nosqltest\nextjs-project\app\api\fantasy"

# List of files to delete (old APIs still using Firebase)
$filesToDelete = @(
    # Draft-related (replaced by draft/player and draft/settings)
    "$apiPath\draft\select\route.ts",
    "$apiPath\draft\assign\route.ts",
    "$apiPath\draft\complete\route.ts",
    
    # Player management (admin features, rarely used)
    "$apiPath\players\manage\route.ts",
    "$apiPath\players\all\route.ts",
    "$apiPath\players\drafted\route.ts",
    "$apiPath\players\[playerId]\stats\route.ts",
    
    # Team features (replaced by my-team)
    "$apiPath\teams\[teamId]\route.ts",
    "$apiPath\teams\[teamId]\breakdown\route.ts",
    
    # Transfer-related (replaced by make-transfer)
    "$apiPath\transfers\player\route.ts",
    "$apiPath\transfers\team\route.ts",
    
    # Admin/Settings (one-time setup, rarely modified)
    "$apiPath\scoring-rules\create\route.ts",
    "$apiPath\scoring-rules\[ruleId]\route.ts",
    
    # Bonus features (not part of core system)
    "$apiPath\calculate-team-bonuses\route.ts",
    "$apiPath\lineups\route.ts",
    "$apiPath\values\update\route.ts"
)

$deletedCount = 0
$notFoundCount = 0

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        Write-Host "  ❌ Deleting: $($file.Replace($apiPath, '...'))" -ForegroundColor Yellow
        Remove-Item $file -Force
        $deletedCount++
    } else {
        Write-Host "  ⏭️  Not found (already deleted?): $($file.Replace($apiPath, '...'))" -ForegroundColor Gray
        $notFoundCount++
    }
}

Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host "✅ Deleted: $deletedCount files" -ForegroundColor Green
Write-Host "⏭️  Not found: $notFoundCount files" -ForegroundColor Gray
Write-Host "`n📊 Result: Old Firebase-based fantasy APIs removed!" -ForegroundColor Cyan
Write-Host "💾 Core features (Phases 1-4) remain in PostgreSQL" -ForegroundColor Green
Write-Host "`n⚠️  Note: Test your fantasy features after this cleanup!" -ForegroundColor Yellow
