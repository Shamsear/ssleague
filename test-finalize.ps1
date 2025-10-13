# Test Round Finalization Script
# This script helps test the round finalization endpoints locally

$baseUrl = "http://localhost:3000"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Round Finalization Test Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Menu
Write-Host "Choose an option:" -ForegroundColor Yellow
Write-Host "1. Test Cron Finalize (Auto finalize expired rounds)"
Write-Host "2. Test Admin Manual Finalize (Provide round ID)"
Write-Host "3. Exit"
Write-Host ""

$choice = Read-Host "Enter your choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`nTesting automatic finalization..." -ForegroundColor Green
        Write-Host "Calling: GET $baseUrl/api/cron/finalize-rounds" -ForegroundColor Gray
        
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/api/cron/finalize-rounds" -Method Get
            Write-Host "`nResponse:" -ForegroundColor Green
            $response | ConvertTo-Json -Depth 10 | Write-Host
        } catch {
            Write-Host "`nError:" -ForegroundColor Red
            Write-Host $_.Exception.Message
        }
    }
    
    "2" {
        $roundId = Read-Host "`nEnter Round ID to finalize"
        
        if ([string]::IsNullOrWhiteSpace($roundId)) {
            Write-Host "Error: Round ID is required" -ForegroundColor Red
            exit
        }
        
        Write-Host "`nTesting manual finalization..." -ForegroundColor Green
        Write-Host "Calling: POST $baseUrl/api/admin/rounds/$roundId/finalize" -ForegroundColor Gray
        Write-Host "Note: You must be logged in as admin" -ForegroundColor Yellow
        
        try {
            # Note: This will only work if you have a valid admin session cookie
            $response = Invoke-RestMethod -Uri "$baseUrl/api/admin/rounds/$roundId/finalize" -Method Post -UseDefaultCredentials -SessionVariable session
            Write-Host "`nResponse:" -ForegroundColor Green
            $response | ConvertTo-Json -Depth 10 | Write-Host
        } catch {
            Write-Host "`nError:" -ForegroundColor Red
            Write-Host $_.Exception.Message
            Write-Host "`nMake sure you're logged in as admin in your browser first" -ForegroundColor Yellow
        }
    }
    
    "3" {
        Write-Host "Exiting..." -ForegroundColor Gray
        exit
    }
    
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
