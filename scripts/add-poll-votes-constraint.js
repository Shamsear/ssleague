const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  // Use tournament database URL
  const databaseUrl = process.env.NEON_TOURNAMENT_DB_URL;
  
  if (!databaseUrl) {
    console.error('❌ NEON_TOURNAMENT_DB_URL environment variable is not set');
    console.error('Please check your .env.local file');
    process.exit(1);
  }

  console.log('🔗 Connecting to tournament database...');
  const sql = neon(databaseUrl);

  try {
    console.log('🔄 Adding unique constraint to poll_votes table...\n');

    // Step 1: Remove duplicate votes
    console.log('Step 1: Removing duplicate votes...');
    await sql`
      DELETE FROM poll_votes a
      USING poll_votes b
      WHERE a.id > b.id
        AND a.poll_id = b.poll_id
        AND a.user_id = b.user_id
        AND a.deleted_at IS NULL
        AND b.deleted_at IS NULL
    `;
    console.log('✅ Duplicates removed');

    // Step 2: Create unique index
    console.log('Step 2: Creating unique index...');
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique_user_poll 
        ON poll_votes(poll_id, user_id) 
        WHERE deleted_at IS NULL
    `;
    console.log('✅ Unique index created');

    // Step 3: Add comment
    await sql`
      COMMENT ON INDEX idx_poll_votes_unique_user_poll IS 'Ensures one user can only vote once per poll (excluding deleted votes)'
    `;

    // Step 4: Verify
    const result = await sql`
      SELECT 
        COUNT(*) as total_votes,
        COUNT(DISTINCT (poll_id, user_id)) as unique_combinations
      FROM poll_votes
      WHERE deleted_at IS NULL
    `;

    console.log('\n✅ Migration completed successfully!');
    console.log('✅ Unique constraint added: (poll_id, user_id)');
    console.log('✅ Users can now only vote once per poll');
    console.log(`\n📊 Stats: ${result[0].total_votes} total votes, ${result[0].unique_combinations} unique user-poll combinations`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
