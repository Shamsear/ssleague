/**
 * Fantasy League Revamp - Phase 4: Engagement Tables Migration Runner
 * Using pg library for better transaction handling
 */

require('dotenv').config({ path: '.env.local' });

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runEngagementMigration() {
  console.log('🚀 Starting Fantasy League Engagement Tables Migration...\n');

  const client = new Client({
    connectionString: process.env.FANTASY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📊 Connecting to Fantasy Database...');
    await client.connect();
    console.log('✅ Connected\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'fantasy_revamp_engagement_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📊 Executing migration...\n');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify tables
    console.log('🔍 Verifying tables...\n');

    const tables = await client.query(`
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
    `);

    console.log('📋 Tables created:');
    tables.rows.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });

    console.log(`\n✅ Total tables created: ${tables.rows.length}/11`);

    if (tables.rows.length !== 11) {
      console.warn('\n⚠️  Warning: Not all tables were created!');
      console.warn('   Expected: 11 tables');
      console.warn(`   Found: ${tables.rows.length} tables`);
    }

    // Verify columns added to fantasy_players
    console.log('\n🔍 Verifying columns added to fantasy_players...\n');

    const playerColumns = await client.query(`
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
    `);

    console.log('📋 Columns added to fantasy_players:');
    playerColumns.rows.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.column_name}`);
    });

    // Verify columns added to fantasy_teams
    const teamColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fantasy_teams' 
      AND column_name IN (
        'auto_sub_enabled',
        'bench_priority'
      )
      ORDER BY column_name
    `);

    console.log('\n📋 Columns added to fantasy_teams:');
    teamColumns.rows.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.column_name}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Tables created: ${tables.rows.length}/11`);
    console.log(`   - Columns added to fantasy_players: ${playerColumns.rows.length}/6`);
    console.log(`   - Columns added to fantasy_teams: ${teamColumns.rows.length}/2`);

    console.log('\n🎉 Phase 4 engagement tables are ready!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration
runEngagementMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed');
    process.exit(1);
  });
