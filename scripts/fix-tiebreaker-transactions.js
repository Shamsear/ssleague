/**
 * Fix missing transactions and player counts for resolved tiebreakers
 * This script checks resolved tiebreakers and reports what needs to be fixed
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function fixTiebreakerTransactions(roundId = 'SSPSLFBR00008') {
  console.log(`🔧 Checking resolved tiebreakers for bulk round ${roundId}...\n`);

  try {
    // Get all resolved tiebreakers for this round
    const tiebreakers = await sql`
      SELECT 
        bt.id,
        bt.player_id,
        bt.player_name,
        bt.player_position,
        bt.current_highest_team_id as winner_team_id,
        bt.current_highest_bid as winning_amount,
        bt.bulk_round_id,
        r.season_id
      FROM bulk_tiebreakers bt
      JOIN rounds r ON bt.bulk_round_id = r.id
      WHERE bt.bulk_round_id = ${roundId}
      AND bt.status = 'resolved'
    `;

    console.log(`📊 Found ${tiebreakers.length} resolved tiebreakers\n`);

    if (tiebreakers.length === 0) {
      console.log('✅ No resolved tiebreakers found.');
      return;
    }

    console.log('Resolved Tiebreakers:');
    console.log('='.repeat(80));
    
    for (const tb of tiebreakers) {
      // Get team name
      const teamResult = await sql`
        SELECT name FROM teams
        WHERE id = ${tb.winner_team_id}
        AND season_id = ${tb.season_id}
        LIMIT 1
      `;

      const teamName = teamResult[0]?.name || 'Unknown Team';

      console.log(`${tb.player_name} (${tb.player_position}) → ${teamName} for £${tb.winning_amount}`);
    }

    console.log('='.repeat(80));
    console.log(`\nTotal: ${tiebreakers.length} player(s) assigned via tiebreakers`);
    
    console.log('\n📝 Note: Transactions are logged in Firebase during tiebreaker resolution.');
    console.log('   If transactions are missing, they were resolved before transaction logging was added.');
    console.log('   The finalize-bulk-tiebreaker.ts now includes transaction logging for future tiebreakers.\n');

    // Now check and fix player counts
    console.log('🔄 Checking player counts in Neon database...\n');
    
    const { execSync } = require('child_process');
    try {
      execSync('echo "yes" | node scripts/fix-football-players-count.js', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to run player count fix:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get round ID from command line or use default
const roundId = process.argv[2] || 'SSPSLFBR00008';

// Run the script
fixTiebreakerTransactions(roundId)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
