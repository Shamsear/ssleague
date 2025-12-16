const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const dbUrl = process.env.NEON_TOURNAMENT_DB_URL;
  
  if (!dbUrl) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment variables');
    process.exit(1);
  }
  
  console.log('🚀 Running substitution fields migration on tournament database...');
  
  try {
    // Read and execute the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_substitution_fields_to_matchups.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    // Use neon's Pool for raw SQL execution
    const { Pool } = require('@neondatabase/serverless');
    const pool = new Pool({ connectionString: dbUrl });
    await pool.query(migrationSQL);
    await pool.end();
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the columns were added
    console.log('\n🔍 Verifying new columns...');
    const sql = neon(dbUrl);
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'matchups'
      AND column_name IN (
        'home_original_player_id',
        'home_original_player_name',
        'home_substituted',
        'home_sub_penalty',
        'away_original_player_id',
        'away_original_player_name',
        'away_substituted',
        'away_sub_penalty'
      )
      ORDER BY column_name
    `;
    
    console.log('\n📊 New columns in matchups table:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    if (columns.length === 8) {
      console.log('\n✅ All 8 substitution columns added successfully!');
    } else {
      console.log(`\n⚠️ Warning: Expected 8 columns, found ${columns.length}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
