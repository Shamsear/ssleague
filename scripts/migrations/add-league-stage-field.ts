import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

async function addLeagueStageField() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🚀 Adding has_league_stage field to tournaments table');

  try {
    // Add column
    await sql`
      ALTER TABLE tournaments 
      ADD COLUMN IF NOT EXISTS has_league_stage BOOLEAN DEFAULT true
    `;
    console.log('✅ Column added');

    // Update existing tournaments
    await sql`
      UPDATE tournaments 
      SET has_league_stage = CASE
          WHEN has_group_stage = true THEN false
          WHEN is_pure_knockout = true THEN false
          ELSE true
      END
      WHERE has_league_stage IS NULL
    `;
    console.log('✅ Existing tournaments updated');

    // Verify
    const result = await sql`
      SELECT id, tournament_name, has_league_stage, has_group_stage, has_knockout_stage, is_pure_knockout
      FROM tournaments
      LIMIT 5
    `;
    console.log('\n📊 Sample tournaments:');
    console.table(result);

    console.log('\n✨ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addLeagueStageField()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
