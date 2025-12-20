/**
 * Debug Vice-Captain Multiplier Issue
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugVCMultiplier() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔍 Debugging Vice-Captain Multiplier Issue\n');

  try {
    // Get squad data for Legends FC (where Muhammed Fijas is VC)
    const squadData = await fantasyDb`
      SELECT 
        real_player_id,
        team_id,
        player_name,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
      WHERE team_id = 'SSPSLT0015'
        AND player_name LIKE 'Muhammed Fijas%'
    `;

    console.log('Squad Data for Muhammed Fijas in Legends FC:');
    console.table(squadData);

    if (squadData.length === 0) {
      console.log('❌ No squad data found');
      return;
    }

    const player = squadData[0];
    
    // Simulate what the recalculation script does
    const playerTeamsMap = new Map();
    squadData.forEach(row => {
      if (!playerTeamsMap.has(row.real_player_id)) {
        playerTeamsMap.set(row.real_player_id, []);
      }
      playerTeamsMap.get(row.real_player_id).push({
        teamId: row.team_id,
        isCaptain: row.is_captain || false,
        isViceCaptain: row.is_vice_captain || false,
        playerName: row.player_name
      });
    });

    const teamInfo = playerTeamsMap.get(player.real_player_id)[0];
    
    console.log('\nTeam Info from Map:');
    console.log(`  Team ID: ${teamInfo.teamId}`);
    console.log(`  Is Captain: ${teamInfo.isCaptain}`);
    console.log(`  Is Vice Captain: ${teamInfo.isViceCaptain}`);

    // Calculate multiplier
    let multiplier = 1;
    if (teamInfo.isCaptain) {
      multiplier = 2;
      console.log('\n  ✅ Would set multiplier to 2 (Captain)');
    } else if (teamInfo.isViceCaptain) {
      multiplier = 1.5;
      console.log('\n  ✅ Would set multiplier to 1.5 (Vice-Captain)');
    } else {
      console.log('\n  ✅ Would set multiplier to 1 (Regular)');
    }

    console.log(`\n  Final Multiplier: ${multiplier}`);

    // Check what's actually in fantasy_player_points
    const playerPoints = await fantasyDb`
      SELECT 
        fixture_id,
        round_number,
        points_multiplier,
        total_points
      FROM fantasy_player_points
      WHERE team_id = ${player.team_id}
        AND real_player_id = ${player.real_player_id}
      ORDER BY round_number
    `;

    console.log('\nActual fantasy_player_points records:');
    console.table(playerPoints);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

debugVCMultiplier()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
