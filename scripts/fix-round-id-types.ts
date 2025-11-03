import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function fixRoundIdTypes() {
  console.log('🔧 Starting round_id type fix migrations...\n');

  try {
    // Migration 1: Fix round_players table
    console.log('📝 Migration 1: Fixing round_players.round_id type...');
    
    // Drop constraint
    await sql`
      ALTER TABLE IF EXISTS round_players 
      DROP CONSTRAINT IF EXISTS round_players_round_id_fkey
    `;
    console.log('   ✓ Dropped old foreign key constraint');

    // Change column type
    await sql`
      ALTER TABLE round_players 
      ALTER COLUMN round_id TYPE VARCHAR(50)
    `;
    console.log('   ✓ Changed round_id to VARCHAR(50)');

    // Recreate constraint
    await sql`
      ALTER TABLE round_players
      ADD CONSTRAINT round_players_round_id_fkey
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
    `;
    console.log('   ✓ Recreated foreign key constraint');

    // Verify
    const verifyPlayers = await sql`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'round_players' AND column_name = 'round_id'
    `;
    console.log('   ✓ Verification:', verifyPlayers[0]);

    console.log('✅ Migration 1 completed!\n');

    // Migration 2: Fix round_bids table
    console.log('📝 Migration 2: Fixing round_bids.round_id type...');
    
    // Drop constraint
    await sql`
      ALTER TABLE IF EXISTS round_bids 
      DROP CONSTRAINT IF EXISTS round_bids_round_id_fkey
    `;
    console.log('   ✓ Dropped old foreign key constraint');

    // Change column type
    await sql`
      ALTER TABLE round_bids 
      ALTER COLUMN round_id TYPE VARCHAR(50)
    `;
    console.log('   ✓ Changed round_id to VARCHAR(50)');

    // Recreate constraint
    await sql`
      ALTER TABLE round_bids
      ADD CONSTRAINT round_bids_round_id_fkey
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
    `;
    console.log('   ✓ Recreated foreign key constraint');

    // Verify
    const verifyBids = await sql`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'round_bids' AND column_name = 'round_id'
    `;
    console.log('   ✓ Verification:', verifyBids[0]);

    console.log('✅ Migration 2 completed!\n');

    console.log('🎉 All migrations completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - round_players.round_id: VARCHAR(50)');
    console.log('   - round_bids.round_id: VARCHAR(50)');
    console.log('   - Both now match rounds.id type');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
fixRoundIdTypes()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
