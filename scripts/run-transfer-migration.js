const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Import Neon client
const { neon } = require('@neondatabase/serverless');

async function runMigration() {
  try {
    console.log('Starting transfer tables migration...');
    
    // Create SQL client
    const sql = neon(process.env.NEON_DATABASE_URL);
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'fantasy_revamp_transfer_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration using unsafe for raw SQL
    await sql.unsafe(migrationSQL);
    
    console.log('✓ Migration completed successfully');
    console.log('✓ Created tables: fantasy_releases, fantasy_trades, fantasy_transfer_windows');
    console.log('✓ Created all indexes');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
