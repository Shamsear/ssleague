/**
 * Migration Script: Add trophies column to teamstats table
 * 
 * This script adds a trophies JSONB column to the existing teamstats table
 * to support storing cup/trophy data for teams.
 * 
 * Run with: npx tsx scripts/add-trophies-to-teamstats.ts
 */

import { getTournamentDb } from '../lib/neon/tournament-config';

async function addTrophiesToTeamstats() {
  console.log('🚀 Starting migration: Add trophies column to teamstats\n');

  const sql = getTournamentDb();

  try {
    // Check if column already exists
    console.log('📝 Checking if trophies column exists...');
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'teamstats' 
        AND column_name = 'trophies'
    `;

    if (checkColumn.length > 0) {
      console.log('✅ trophies column already exists in teamstats table');
      console.log('   No migration needed\n');
      return;
    }

    // Add the trophies column
    console.log('📝 Adding trophies column to teamstats table...');
    await sql`
      ALTER TABLE teamstats
      ADD COLUMN trophies JSONB DEFAULT '[]'::jsonb
    `;
    console.log('✅ Successfully added trophies column\n');

    // Verify the column was added
    const verify = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'teamstats' 
        AND column_name = 'trophies'
    `;

    if (verify.length > 0) {
      console.log('✅ Verification successful!');
      console.log('   Column details:', verify[0]);
      console.log('\n✅ Migration completed successfully!\n');
    } else {
      console.error('❌ Verification failed - column not found after creation');
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run the migration
addTrophiesToTeamstats()
  .then(() => {
    console.log('✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
