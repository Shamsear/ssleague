// Script to run the fantasy draft tables migration
const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.FANTASY_DATABASE_URL });

  console.log('🚀 Running Fantasy League Revamp - Draft Tables Migration\n');
  console.log('============================================');
  console.log('Database:', process.env.FANTASY_DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown');
  console.log('============================================\n');

  const client = await pool.connect();

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'fantasy_revamp_draft_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully\n');
    console.log('🚀 Executing migration...\n');

    // Execute the entire migration as a single transaction
    await client.query(migrationSQL);

    console.log('✅ Migration SQL executed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('fantasy_draft_tiers', 'fantasy_tier_bids')
      ORDER BY table_name
    `);

    console.log('📊 Tables created:');
    tablesResult.rows.forEach(table => {
      console.log(`  ✓ ${table.table_name}`);
    });

    // Check if indexes exist
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND (indexname LIKE 'idx_draft_tiers_%' OR indexname LIKE 'idx_tier_bids_%')
      ORDER BY indexname
    `);

    console.log('\n📊 Indexes created:');
    indexesResult.rows.forEach(index => {
      console.log(`  ✓ ${index.indexname}`);
    });

    // Check if fantasy_leagues columns were added
    const columnsResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'fantasy_leagues' 
      AND column_name IN (
        'min_squad_size', 
        'max_squad_size', 
        'starting_lineup_size', 
        'number_of_tiers',
        'lineup_lock_enabled',
        'lineup_lock_hours_before'
      )
      ORDER BY column_name
    `);

    console.log('\n📊 fantasy_leagues columns added:');
    columnsResult.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });

    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
