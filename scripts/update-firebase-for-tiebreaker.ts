/**
 * Update Firebase team_seasons for a finalized tiebreaker
 * Use this when finalization completed in PostgreSQL but Firebase failed
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { adminDb } from '../lib/firebase/admin';
import { logAuctionWin } from '../lib/transaction-logger';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
  dotenv.config({ path: resolve(__dirname, '../.env') });
}

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function updateFirebaseForTiebreaker(tiebreakerId: string) {
  try {
    console.log(`🔍 Looking up tiebreaker ${tiebreakerId}...\n`);

    // Get tiebreaker details
    const tiebreakerResult = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        player_position as position,
        bulk_round_id as round_id,
        current_highest_bid,
        current_highest_team_id,
        status
      FROM bulk_tiebreakers
      WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerResult.length === 0) {
      console.error('❌ Tiebreaker not found');
      return;
    }

    const tiebreaker = tiebreakerResult[0];

    console.log(`Tiebreaker: ${tiebreaker.player_name}`);
    console.log(`Status: ${tiebreaker.status}`);
    console.log(`Winner Team: ${tiebreaker.current_highest_team_id}`);
    console.log(`Winning Bid: £${tiebreaker.current_highest_bid}`);

    if (tiebreaker.status !== 'resolved') {
      console.error(`\n❌ Tiebreaker is not resolved (status: ${tiebreaker.status})`);
      return;
    }

    // Get round and season info
    const roundResult = await sql`
      SELECT season_id FROM rounds WHERE id = ${tiebreaker.round_id}
    `;

    if (roundResult.length === 0) {
      console.error('❌ Round not found');
      return;
    }

    const seasonId = roundResult[0].season_id;
    const winningAmount = tiebreaker.current_highest_bid;
    const winnerTeamId = tiebreaker.current_highest_team_id;

    console.log(`Season: ${seasonId}`);
    console.log(`\n🔄 Updating Firebase team_seasons...\n`);

    // Update Firebase
    const teamSeasonId = `${winnerTeamId}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();

    if (!teamSeasonSnap.exists) {
      console.error(`❌ Team season ${teamSeasonId} not found in Firebase`);
      return;
    }

    const teamSeasonData = teamSeasonSnap.data()!;

    // Get current values
    const currentFootballBudget = teamSeasonData?.football_budget || 0;
    const currentFootballSpent = teamSeasonData?.football_spent || 0;
    const newFootballBudget = currentFootballBudget - winningAmount;
    const newFootballSpent = currentFootballSpent + winningAmount;

    // Get current position counts
    const positionCounts = teamSeasonData?.position_counts || {};
    const currentPositionCount = positionCounts[tiebreaker.position] || 0;
    const newPositionCounts = {
      ...positionCounts,
      [tiebreaker.position]: currentPositionCount + 1
    };

    console.log(`Current football_budget: £${currentFootballBudget}`);
    console.log(`Current football_spent: £${currentFootballSpent}`);
    console.log(`Position ${tiebreaker.position} count: ${currentPositionCount}`);

    // Update
    await teamSeasonRef.update({
      football_budget: newFootballBudget,
      football_spent: newFootballSpent,
      position_counts: newPositionCounts,
      updated_at: new Date()
    });

    console.log(`\n✅ Updated team_seasons:`);
    console.log(`   football_budget: £${currentFootballBudget} → £${newFootballBudget}`);
    console.log(`   football_spent: £${currentFootballSpent} → £${newFootballSpent}`);
    console.log(`   ${tiebreaker.position} count: ${currentPositionCount} → ${currentPositionCount + 1}`);

    // Log transaction
    await logAuctionWin(
      winnerTeamId,
      seasonId,
      tiebreaker.player_name || 'Unknown Player',
      tiebreaker.player_id,
      'football',
      winningAmount,
      currentFootballBudget,
      tiebreaker.round_id
    );

    console.log(`\n✅ Transaction logged in Firebase`);
    console.log(`\n🎉 Firebase update complete!`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Get tiebreaker ID from command line or use default
const tiebreakerId = process.argv[2] || 'SSPSLTR00001';

console.log('='*60);
console.log('Update Firebase for Finalized Tiebreaker');
console.log('='*60 + '\n');

updateFirebaseForTiebreaker(tiebreakerId)
  .then(() => {
    console.log('\n' + '='*60);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
