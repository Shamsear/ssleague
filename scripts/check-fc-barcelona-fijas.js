/**
 * Check FC Barcelona - Muhammed Fijas data
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFCBarcelonaFijas() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Checking FC Barcelona - Muhammed Fijas\n');

  try {
    // Get FC Barcelona team
    const teams = await fantasyDb`
      SELECT team_id, team_name
      FROM fantasy_teams
      WHERE team_name = 'FC Barcelona'
    `;

    if (teams.length === 0) {
      console.log('❌ Team not found');
      return;
    }

    const team = teams[0];
    console.log(`Team: ${team.team_name} (${team.team_id})\n`);

    // Get Muhammed Fijas from squad
    const squadPlayers = await fantasyDb`
      SELECT 
        real_player_id,
        player_name,
        total_points,
        is_captain,
        is_vice_captain
      FROM fantasy_squad
      WHERE team_id = ${team.team_id}
        AND player_name LIKE 'Muhammed Fijas%'
    `;

    if (squadPlayers.length === 0) {
      console.log('❌ Player not found in squad');
      return;
    }

    const player = squadPlayers[0];
    console.log('Squad Info:');
    console.log(`  Player: ${player.player_name}`);
    console.log(`  Player ID: ${player.real_player_id}`);
    console.log(`  Total Points: ${player.total_points}`);
    console.log(`  Is Captain: ${player.is_captain}`);
    console.log(`  Is Vice Captain: ${player.is_vice_captain}`);

    // Get fantasy_player_points records
    const playerPoints = await fantasyDb`
      SELECT 
        fixture_id,
        round_number,
        goals_scored,
        is_captain,
        points_multiplier,
        base_points,
        total_points
      FROM fantasy_player_points
      WHERE team_id = ${team.team_id}
        AND real_player_id = ${player.real_player_id}
      ORDER BY round_number
    `;

    console.log(`\n📋 Fantasy Player Points Records:\n`);

    let sumTotal = 0;
    playerPoints.forEach((record, index) => {
      console.log(`Round ${record.round_number}:`);
      console.log(`  Fixture: ${record.fixture_id}`);
      console.log(`  Goals: ${record.goals_scored}`);
      console.log(`  Base Points: ${record.base_points}`);
      console.log(`  Is Captain: ${record.is_captain}`);
      console.log(`  Points Multiplier: ${record.points_multiplier}`);
      console.log(`  Total Points: ${record.total_points}`);
      
      // Calculate what it should be
      const expectedMultiplier = record.points_multiplier === 200 ? 2 : record.points_multiplier === 150 ? 1.5 : 1;
      const expectedTotal = Math.round(record.base_points * expectedMultiplier);
      const isCorrect = expectedTotal === record.total_points;
      
      console.log(`  Expected: ${record.base_points} × ${expectedMultiplier} = ${expectedTotal} ${isCorrect ? '✅' : '❌'}`);
      console.log('');
      
      sumTotal += record.total_points;
    });

    console.log(`Sum of records: ${sumTotal}`);
    console.log(`Squad total: ${player.total_points}`);
    console.log(`Match: ${sumTotal === player.total_points ? '✅' : '❌'}`);

    // Check what the squad says vs what the records say
    console.log(`\n📊 Analysis:`);
    console.log(`  Squad says: ${player.is_captain ? 'Captain' : player.is_vice_captain ? 'Vice-Captain' : 'Regular'}`);
    console.log(`  Records say: Multiplier ${playerPoints[0]?.points_multiplier} (${playerPoints[0]?.points_multiplier === 200 ? 'Captain' : playerPoints[0]?.points_multiplier === 150 ? 'Vice-Captain' : 'Regular'})`);
    console.log(`  Points match: ${player.is_captain ? '2x' : player.is_vice_captain ? '1.5x' : '1x'} multiplier`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkFCBarcelonaFijas()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
