$body = @{
    confirm = "INITIALIZE_ALL_PLAYERS"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/realplayers/initialize-ratings" -Method POST -ContentType "application/json" -Body $body

Write-Host "Response:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 10
