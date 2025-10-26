/**
 * Update tournament_settings table with all required columns
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config({ path: '.env.local' });

async function updateTournamentSettings() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🚀 Updating tournament_settings table...');
  console.log('==========================================\n');

  try {
    // Add all columns
    console.log('📊 Adding columns...');
    
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS squad_size INTEGER DEFAULT 11`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS tournament_system VARCHAR(50) DEFAULT 'match_round'`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS home_deadline_time VARCHAR(10) DEFAULT '17:00'`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS away_deadline_time VARCHAR(10) DEFAULT '17:00'`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_day_offset INTEGER DEFAULT 2`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_deadline_time VARCHAR(10) DEFAULT '00:30'`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS has_knockout_stage BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS playoff_teams INTEGER DEFAULT 4`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS direct_semifinal_teams INTEGER DEFAULT 2`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS qualification_threshold INTEGER DEFAULT 75`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;

    console.log('✅ All columns added\n');

    // Verify columns
    console.log('📋 Verifying columns...');
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tournament_settings' 
      ORDER BY ordinal_position
    `;

    console.log('\nColumns in tournament_settings table:');
    columns.forEach((col: any) => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    console.log('\n==========================================');
    console.log('✨ Migration Complete!');
    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
updateTournamentSettings()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
