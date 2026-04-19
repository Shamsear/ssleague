const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

const ROUND_ID = process.argv[2] || 'SSPSLFBR00009';

async function checkTiebreakerStatus() {
  console.log(`\n🔍 Checking Tiebreaker Status for Round: ${ROUND_ID}\n`);

  try {
    // Get all tiebreakers for this round
    const tiebreakers = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        status,
        current_highest_team_id,
        current_highest_bid,
        teams_remaining,
        created_at,
        resolved_at
      FROM bulk_tiebreakers
      WHERE bulk_round_id = ${ROUND_ID}
      ORDER BY created_at DESC
    `;

    if (tiebreakers.length === 0) {
      console.log(`⚠️  No tiebreakers found for round ${ROUND_ID}\n`);
      return;
    }

    console.log(`📊 Found ${tiebreakers.length} tiebreaker(s)\n`);
    console.log('='.repeat(80));

    for (const tb of tiebreakers) {
      console.log(`\n🎯 Tiebreaker: ${tb.id}`);
      console.log(`   Player: ${tb.player_name} (ID: ${tb.player_id})`);
      console.log(`   Status: ${tb.status}`);
      console.log(`   Winner Team ID: ${tb.current_highest_team_id || 'None'}`);
      console.log(`   Winning Bid: £${tb.current_highest_bid || 0}`);
      console.log(`   Teams Remaining: ${tb.teams_remaining || 0}`);
      console.log(`   Created: ${new Date(tb.created_at).toLocaleString()}`);
      console.log(`   Resolved: ${tb.resolved_at ? new Date(tb.resolved_at).toLocaleString() : 'Not resolved'}`);

      // Check if player is in team_players
      const teamPlayer = await sql`
        SELECT team_id, season_id, purchase_price, acquired_at
        FROM team_players
        WHERE player_id = ${tb.player_id}
      `;

      if (teamPlayer.length > 0) {
        const tp = teamPlayer[0];
        console.log(`\n   ✅ Player in team_players:`);
        console.log(`      Team: ${tp.team_id}`);
        console.log(`      Season: ${tp.season_id}`);
        console.log(`      Purchase Price: £${tp.purchase_price}`);
        console.log(`      Acquired: ${new Date(tp.acquired_at).toLocaleString()}`);
        
        if (tp.team_id !== tb.current_highest_team_id) {
          console.log(`      ⚠️  WARNING: team_players team (${tp.team_id}) doesn't match tiebreaker winner (${tb.current_highest_team_id})`);
        }
      } else {
        console.log(`\n   ❌ Player NOT in team_players table`);
      }

      // Check teams in this tiebreaker
      const teams = await sql`
        SELECT 
          team_id,
          team_name,
          status,
          current_bid,
          joined_at,
          withdrawn_at
        FROM bulk_tiebreaker_teams
        WHERE tiebreaker_id = ${tb.id}
        ORDER BY current_bid DESC NULLS LAST
      `;

      console.log(`\n   👥 Teams (${teams.length}):`);
      teams.forEach((team, idx) => {
        const isWinner = team.team_id === tb.current_highest_team_id;
        console.log(`      ${idx + 1}. ${team.team_name} (${team.team_id})`);
        console.log(`         Status: ${team.status}${isWinner ? ' 🏆 WINNER' : ''}`);
        console.log(`         Bid: £${team.current_bid || 0}`);
        if (team.withdrawn_at) {
          console.log(`         Withdrawn: ${new Date(team.withdrawn_at).toLocaleString()}`);
        }
      });

      console.log('\n' + '-'.repeat(80));
    }

    console.log('\n📋 Summary:');
    console.log(`   Total tiebreakers: ${tiebreakers.length}`);
    console.log(`   Resolved: ${tiebreakers.filter(t => t.status === 'resolved' || t.status === 'finalized').length}`);
    console.log(`   Active: ${tiebreakers.filter(t => t.status === 'active' || t.status === 'ongoing').length}`);
    console.log(`   Pending: ${tiebreakers.filter(t => t.status === 'pending').length}`);
    
    const withWinner = tiebreakers.filter(t => t.current_highest_team_id).length;
    const withoutWinner = tiebreakers.length - withWinner;
    console.log(`   With winner: ${withWinner}`);
    console.log(`   Without winner: ${withoutWinner}`);

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkTiebreakerStatus();
