/**
 * Sync team_players table with bulk tiebreaker winners
 * Finds players won through bulk tiebreakers that are missing from team_players
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function syncTiebreakerPlayers() {
  try {
    console.log('🔍 Finding players won through bulk tiebreakers...\n');

    // Find resolved bulk tiebreakers with winners
    const resolvedTiebreakers = await sql`
      SELECT 
        bt.id as tiebreaker_id,
        bt.player_id,
        bt.player_name,
        bt.current_highest_team_id as team_id,
        bt.current_highest_bid as winning_bid,
        bt.resolved_at,
        fp.name as player_actual_name,
        fp.position,
        fp.team_id as current_team_id,
        fp.acquisition_value
      FROM bulk_tiebreakers bt
      INNER JOIN footballplayers fp ON bt.player_id = fp.id
      WHERE bt.status = 'resolved'
      AND bt.current_highest_team_id IS NOT NULL
      ORDER BY bt.resolved_at DESC
    `;

    console.log(`✅ Found ${resolvedTiebreakers.length} resolved bulk tiebreakers\n`);

    if (resolvedTiebreakers.length === 0) {
      console.log('No resolved tiebreakers found. Exiting.');
      return;
    }

    // Check which players are missing from team_players
    let missingCount = 0;
    let insertedCount = 0;
    let alreadyExistsCount = 0;

    for (const tb of resolvedTiebreakers) {
      // Check if player exists in team_players for this team
      const existingRecord = await sql`
        SELECT id FROM team_players
        WHERE team_id = ${tb.team_id}
        AND player_id = ${tb.player_id}
      `;

      if (existingRecord.length > 0) {
        console.log(`✓ Player ${tb.player_name} already in team_players for team ${tb.team_id}`);
        alreadyExistsCount++;
        continue;
      }

      // Missing - insert it
      missingCount++;
      console.log(`\n❌ MISSING: Player ${tb.player_name} (${tb.player_id}) for team ${tb.team_id}`);
      console.log(`   Winning bid: £${tb.winning_bid}`);
      console.log(`   Resolved at: ${tb.resolved_at}`);

      try {
        await sql`
          INSERT INTO team_players (
            team_id,
            player_id,
            purchase_price,
            acquired_at
          ) VALUES (
            ${tb.team_id},
            ${tb.player_id},
            ${tb.winning_bid},
            ${tb.resolved_at || new Date()}
          )
        `;
        console.log(`   ✅ Inserted into team_players`);
        insertedCount++;
      } catch (error: any) {
        console.error(`   ❌ Failed to insert: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`   Total resolved tiebreakers: ${resolvedTiebreakers.length}`);
    console.log(`   Already in team_players: ${alreadyExistsCount}`);
    console.log(`   Missing from team_players: ${missingCount}`);
    console.log(`   Successfully inserted: ${insertedCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error syncing tiebreaker players:', error);
    throw error;
  }
}

// Run the script
syncTiebreakerPlayers()
  .then(() => {
    console.log('\n✅ Sync completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  });
