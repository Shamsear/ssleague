/**
 * Script to manually finalize pending bulk tiebreakers
 * Run this if a tiebreaker is stuck in 'auto_finalize_pending' status
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { adminDb } from '../lib/firebase/admin';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
  dotenv.config({ path: resolve(__dirname, '../.env') });
}

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function finalizePendingTiebreakers() {
  // Initialize Firebase (importing adminDb will initialize it)
  await adminDb.collection('users').limit(1).get();
  console.log('🔥 Firebase Admin initialized\n');
  try {
    console.log('🔍 Checking for pending tiebreakers...\n');

    // Find all tiebreakers with auto_finalize_pending status
    const pendingTiebreakers = await sql`
      SELECT 
        id,
        player_name,
        current_highest_team_id,
        current_highest_bid,
        status
      FROM bulk_tiebreakers
      WHERE status IN ('auto_finalize_pending', 'active')
      ORDER BY created_at DESC
    `;

    if (pendingTiebreakers.length === 0) {
      console.log('✅ No pending tiebreakers found.');
      return;
    }

    console.log(`📋 Found ${pendingTiebreakers.length} tiebreaker(s):\n`);
    
    for (const tb of pendingTiebreakers) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Tiebreaker ID: ${tb.id}`);
      console.log(`Player: ${tb.player_name}`);
      console.log(`Winner Team: ${tb.current_highest_team_id}`);
      console.log(`Final Bid: £${tb.current_highest_bid}`);
      console.log(`Status: ${tb.status}`);
      
      // Check how many teams are still active
      const activeTeams = await sql`
        SELECT team_id, team_name, status
        FROM bulk_tiebreaker_teams
        WHERE tiebreaker_id = ${tb.id}
      `;
      
      const teamsLeft = activeTeams.filter(t => t.status === 'active').length;
      console.log(`Teams remaining (active): ${teamsLeft}`);
      console.log(`All teams:`);
      activeTeams.forEach(t => {
        console.log(`  - ${t.team_name} (${t.team_id}): ${t.status}`);
      });
      
      if (teamsLeft === 1) {
        console.log('\n🔄 Attempting to finalize...');
        
        // Import the finalization function
        const { finalizeBulkTiebreaker } = await import('../lib/finalize-bulk-tiebreaker.js');
        
        const result = await finalizeBulkTiebreaker(tb.id);
        
        if (result.success) {
          console.log('✅ Successfully finalized!');
          console.log(`   Winner: Team ${result.winner_team_id}`);
          console.log(`   Amount: £${result.winning_amount}`);
        } else {
          console.error('❌ Finalization failed:');
          console.error(`   Error: ${result.error}`);
        }
      } else if (teamsLeft > 1) {
        console.log('⚠️  Cannot finalize - more than 1 team still active');
      } else {
        console.log('⚠️  Cannot finalize - no active teams found');
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('\n✅ Script completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
finalizePendingTiebreakers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
