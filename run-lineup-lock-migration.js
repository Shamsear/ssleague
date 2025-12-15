require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

async function runMigration() {
  const databaseUrl = process.env.FANTASY_DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ FANTASY_DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  console.log('🔄 Adding lineup lock control to fantasy_leagues table...');
  console.log('📍 Database: FANTASY_DATABASE_URL');

  const sql = neon(databaseUrl);

  try {
    const migration = fs.readFileSync('migrations/add_lineup_lock_to_fantasy_leagues.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = migration.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await sql([statement]);

      }
    }

    console.log('✅ Lineup lock column added successfully!');
    console.log('📋 Changes:');
    console.log('- Added is_lineup_locked BOOLEAN column');
    console.log('- Default value: false (lineups unlocked)');
    console.log('- Added performance index');
    console.log('✨ Admins can now lock/unlock lineup changes!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
