/**
 * Fantasy League Revamp - Phase 4: Engagement Tables Migration Runner
 * 
 * This script runs the engagement tables migration and verifies all tables were created.
 * 
 * Usage: node scripts/run-engagement-migration.js
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runEngagementMigration() {
  console.log('🚀 Starting Fantasy League Engagement Tables Migration...\n');

  // Get database URL from environment (use FANTASY_DATABASE_URL for fantasy league)
  const databaseUrl = process.env.FANTASY_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('FANTASY_DATABASE_URL environment variable is not set');
  }

  console.log('📊 Using Fantasy Database URL');
  
  // Create database connection
  const sql = neon(databaseUrl);

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'fantasy_revamp_engagement_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📊 Executing migration...\n');

    // Execute migration using unsafe for raw SQL
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN (
        'fixture_difficulty_ratings',
        'fantasy_predictions',
        'fantasy_challenges',
        'fantasy_challenge_completions',
        'fantasy_power_ups',
        'fantasy_power_up_usage',
        'fantasy_h2h_fixtures',
        'fantasy_h2h_standings',
        'fantasy_chat_messages',
        'fantasy_achievements',
        'fantasy_team_achievements'
      )
      ORDER BY table_name
    `;

    console.log('📋 Tables created:');
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });

    console.log(`\n✅ Total tables created: ${tables.length}/11`);

    if (tables.length !== 11) {
      console.warn('\n⚠️  Warning: Not all tables were created!');
      console.warn('   Expected: 11 tables');
      console.warn(`   Found: ${tables.length} tables`);
    }

    // Verify indexes
    console.log('\n🔍 Verifying indexes...\n');

    const indexes = await sql`
      SELECT 
        tablename, 
        COUNT(*) as index_count
      FROM pg_indexes
      WHERE tablename IN (
        'fixture_difficulty_ratings',
        'fantasy_predictions',
        'fantasy_challenges',
        'fantasy_challenge_completions',
        'fantasy_power_ups',
        'fantasy_power_up_usage',
        'fantasy_h2h_fixtures',
        'fantasy_h2h_standings',
        'fantasy_chat_messages',
        'fantasy_achievements',
        'fantasy_team_achievements'
      )
      GROUP BY tablename
      ORDER BY tablename
    `;

    console.log('📋 Indexes created:');
    let totalIndexes = 0;
    indexes.forEach((row) => {
      console.log(`   ${row.tablename}: ${row.index_count} indexes`);
      totalIndexes += parseInt(row.index_count);
    });

    console.log(`\n✅ Total indexes created: ${totalIndexes}`);

    // Verify columns added to existing tables
    console.log('\n🔍 Verifying columns added to existing tables...\n');

    const playerColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fantasy_players' 
      AND column_name IN (
        'form_status',
        'form_streak',
        'last_5_games_avg',
        'form_multiplier',
        'games_played',
        'ownership_percentage'
      )
      ORDER BY column_name
    `;

    console.log('📋 Columns added to fantasy_players:');
    playerColumns.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.column_name}`);
    });

    const teamColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fantasy_teams' 
      AND column_name IN (
        'auto_sub_enabled',
        'bench_priority'
      )
      ORDER BY column_name
    `;

    console.log('\n📋 Columns added to fantasy_teams:');
    teamColumns.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.column_name}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Tables created: ${tables.length}/11`);
    console.log(`   - Indexes created: ${totalIndexes}`);
    console.log(`   - Columns added to fantasy_players: ${playerColumns.length}/6`);
    console.log(`   - Columns added to fantasy_teams: ${teamColumns.length}/2`);

    console.log('\n🎉 Phase 4 engagement tables are ready!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
runEngagementMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
