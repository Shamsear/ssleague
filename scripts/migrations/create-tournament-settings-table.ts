/**
 * Migration: Create tournament_settings table
 * 
 * Stores tournament configuration settings per season
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config({ path: '.env.local' });

async function createTournamentSettingsTable() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  try {
    console.log('🔧 Creating tournament_settings table...');

    await sql`
      CREATE TABLE IF NOT EXISTS tournament_settings (
        season_id TEXT PRIMARY KEY,
        tournament_name TEXT,
        squad_size INTEGER,
        tournament_system TEXT DEFAULT 'match_round',
        home_deadline_time TEXT DEFAULT '17:00',
        away_deadline_time TEXT DEFAULT '17:00',
        result_day_offset INTEGER DEFAULT 2,
        result_deadline_time TEXT DEFAULT '00:30',
        has_knockout_stage BOOLEAN DEFAULT false,
        playoff_teams INTEGER,
        direct_semifinal_teams INTEGER,
        qualification_threshold INTEGER,
        is_two_legged BOOLEAN DEFAULT true,
        num_teams INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('✅ Table created successfully');

    // Create index on season_id for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tournament_settings_season_id 
      ON tournament_settings(season_id)
    `;

    console.log('✅ Index created successfully');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
createTournamentSettingsTable()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
