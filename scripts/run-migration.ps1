# Historical Teams Migration Runner
# Calls the Next.js API endpoint that has Firebase access

Write-Host "`n" -NoNewline
Write-Host "=" -NoNewline -ForegroundColor Gray
Write-Host ("=" * 78) -ForegroundColor Gray
Write-Host "🔧 HISTORICAL TEAMS MIGRATION" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Gray
Write-Host ""

# Check if server is running
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/" -Method Head -TimeoutSec 2 -ErrorAction Stop
} catch {
    Write-Host "❌ Error: Next.js dev server is not running!" -ForegroundColor Red
    Write-Host "`nPlease start the server first:" -ForegroundColor Yellow
    Write-Host "  npm run dev`n"
    exit 1
}

Write-Host "✅ Server is running`n"

# Make the API call
Write-Host "🔍 Running migration..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/migrate/add-historical-teams" -Method Post -TimeoutSec 300
    
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host "`n✅ MIGRATION COMPLETE!`n" -ForegroundColor Green
    
    Write-Host "📊 RESULTS:" -ForegroundColor Yellow
    Write-Host "Total teams in Firebase: $($response.stats.totalInFirebase)"
    Write-Host "Already in Neon: $($response.stats.alreadyInNeon)"
    Write-Host "Successfully added: $($response.stats.successful)" -ForegroundColor Green
    
    if ($response.stats.failed -gt 0) {
        Write-Host "Failed: $($response.stats.failed)" -ForegroundColor Red
    }
    
    Write-Host "`n📋 Teams added:`n"
    foreach ($team in $response.inserted) {
        Write-Host "  ✓ $team" -ForegroundColor Green
    }
    
    Write-Host "`n" + ("=" * 80) -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host "`n❌ ERROR RUNNING MIGRATION`n" -ForegroundColor Red
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message
    Write-Host "`nPlease check the Next.js server logs for more details.`n"
}
