# Backup Current Firebase Configuration
# This script backs up your current .env.local file before switching databases

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = ".env.local.backup_$timestamp"
$sourceFile = ".env.local"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Firebase Configuration Backup Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (Test-Path $sourceFile) {
    # Create backup
    Copy-Item $sourceFile $backupFile
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "   Backed up to: $backupFile" -ForegroundColor Green
    Write-Host ""
    
    # Show current configuration (masked)
    Write-Host "Current Configuration (partial view):" -ForegroundColor Yellow
    Get-Content $sourceFile | Select-String "NEXT_PUBLIC_FIREBASE_PROJECT_ID" | ForEach-Object {
        Write-Host "   $_" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "📝 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Create new Firebase project at https://console.firebase.google.com/" -ForegroundColor White
    Write-Host "   2. Get new configuration values" -ForegroundColor White
    Write-Host "   3. Update .env.local with new values" -ForegroundColor White
    Write-Host "   4. Run: npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 To restore this backup later:" -ForegroundColor Yellow
    Write-Host "   Copy-Item $backupFile .env.local" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host "❌ Error: .env.local file not found!" -ForegroundColor Red
    Write-Host "   Make sure you're in the project root directory" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "============================================" -ForegroundColor Cyan
