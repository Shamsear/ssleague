import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function addFinalizingStatus() {
  try {
    console.log('Updating rounds table status constraint...\n');

    // Drop the old constraint
    await sql`
      ALTER TABLE rounds 
      DROP CONSTRAINT IF EXISTS rounds_status_check
    `;
    console.log('✅ Dropped old status constraint');

    // Add new constraint with 'finalizing' status
    await sql`
      ALTER TABLE rounds 
      ADD CONSTRAINT rounds_status_check 
      CHECK (status IN ('active', 'completed', 'finalizing', 'tiebreaker', 'cancelled'))
    `;
    console.log('✅ Added new status constraint with "finalizing" status');

    console.log('\n📋 Updated Rounds Status Values:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Allowed status values:');
    console.log('  - active: Round is open for bidding');
    console.log('  - completed: Round finished successfully');
    console.log('  - finalizing: Round being finalized (processing bids)');
    console.log('  - tiebreaker: Round has active tiebreakers');
    console.log('  - cancelled: Round was cancelled');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Migration Complete!');
    console.log('\nThe "finalizing" status can now be used to indicate rounds that are');
    console.log('in the process of being finalized (e.g., when tiebreakers are detected).\n');

  } catch (error) {
    console.error('❌ Error updating rounds status constraint:', error);
    process.exit(1);
  }
}

addFinalizingStatus();
