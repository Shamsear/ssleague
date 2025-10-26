/**
 * Migration: Add match_number column to fixtures table
 * 
 * The match_number column is used to order fixtures within a round
 * when displaying them in the UI.
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config({ path: '.env.local' });

async function addMatchNumberColumn() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  try {
    console.log('🔧 Adding match_number column to fixtures table...');

    // Add the column (with default value for existing rows)
    await sql`
      ALTER TABLE fixtures
      ADD COLUMN IF NOT EXISTS match_number INTEGER DEFAULT 1
    `;

    console.log('✅ Column added successfully');

    // Update existing fixtures to have sequential match numbers per round
    console.log('🔄 Updating existing fixtures with match numbers...');
    
    await sql`
      WITH numbered_fixtures AS (
        SELECT 
          id,
          ROW_NUMBER() OVER (PARTITION BY season_id, round_number ORDER BY created_at) as match_num
        FROM fixtures
      )
      UPDATE fixtures
      SET match_number = numbered_fixtures.match_num
      FROM numbered_fixtures
      WHERE fixtures.id = numbered_fixtures.id
    `;

    console.log('✅ Existing fixtures updated with match numbers');

    // Make the column NOT NULL after setting values
    await sql`
      ALTER TABLE fixtures
      ALTER COLUMN match_number SET NOT NULL
    `;

    console.log('✅ Column set to NOT NULL');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
addMatchNumberColumn()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
