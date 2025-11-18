# PowerShell script to run logo_url migration
# Reads DATABASE_URL from .env.local and executes the migration

# Load .env.local file
$envFile = Join-Path $PSScriptRoot "..\\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            
            # Remove quotes if present
            $value = $value -replace '^[''"]|[''"]$', ''
            
            # Set environment variable
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "✅ Loaded environment variables from .env.local"
} else {
    Write-Host "❌ .env.local file not found"
    exit 1
}

# Get DATABASE_URL
$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    $databaseUrl = $env:NEON_DATABASE_URL
}

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL or NEON_DATABASE_URL not found in environment"
    exit 1
}

Write-Host "🔄 Running migration to add logo_url column to teams table..."

# Read the migration SQL file
$migrationFile = Join-Path $PSScriptRoot "..\database\migrations\add-logo-url-to-teams.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile"
    exit 1
}

$migrationSql = Get-Content $migrationFile -Raw

# Use psql to run the migration
# Note: This requires psql to be installed and in PATH
try {
    $migrationSql | psql $databaseUrl
    Write-Host "✅ Migration completed successfully!"
} catch {
    Write-Host "❌ Migration failed: $_"
    Write-Host ""
    Write-Host "If psql is not installed, you can run the migration manually:"
    Write-Host "1. Connect to your database using your preferred SQL client"
    Write-Host "2. Run the SQL from: database\migrations\add-logo-url-to-teams.sql"
    exit 1
}
