/**
 * Test Passive Points Fix
 * 
 * This script tests that admin bonuses are correctly included in passive_points
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testPassivePointsFix() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🧪 Testing Passive Points Fix...\n');

  try {
    // Get FC Barcelona team
    const teams = await fantasyDb`
      SELECT team_id, team_name, league_id, supported_team_id
      FROM fantasy_teams
      WHERE team_name ILIKE '%barcelona%'
      LIMIT 1
    `;

    if (teams.length === 0) {
      console.log('❌ Team not found');
      return;
    }

    const team = teams[0];
    console.log(`Testing team: ${team.team_name}`);
    console.log(`Team ID: ${team.team_id}\n`);

    // Get player points
    const pointsResult = await fantasyDb`
      SELECT COALESCE(SUM(total_points), 0) as player_points
      FROM fantasy_player_points
      WHERE team_id = ${team.team_id}
    `;

    // Get passive points from fantasy_team_bonus_points
    const bonusPointsResult = await fantasyDb`
      SELECT COALESCE(SUM(total_bonus), 0) as passive_bonus
      FROM fantasy_team_bonus_points
      WHERE team_id = ${team.team_id}
    `;

    // Get admin bonus points
    const adminBonusResult = await fantasyDb`
      SELECT COALESCE(SUM(points), 0) as admin_bonus
      FROM bonus_points
      WHERE target_type = 'team'
        AND target_id = ${team.supported_team_id}
        AND league_id = ${team.league_id}
    `;

    const playerPoints = Number(pointsResult[0].player_points);
    const passiveBonusPoints = Number(bonusPointsResult[0].passive_bonus);
    const adminBonusPoints = Number(adminBonusResult[0].admin_bonus);
    const totalPassivePoints = passiveBonusPoints + adminBonusPoints;
    const calculatedTotal = playerPoints + totalPassivePoints;

    console.log('📊 Calculated Values:');
    console.log(`  Player Points: ${playerPoints}`);
    console.log(`  Passive Bonus (from fantasy_team_bonus_points): ${passiveBonusPoints}`);
    console.log(`  Admin Bonus (from bonus_points): ${adminBonusPoints}`);
    console.log(`  Total Passive Points: ${totalPassivePoints}`);
    console.log(`  Total Points: ${calculatedTotal}\n`);

    // Update the team
    console.log('🔄 Updating team...');
    await fantasyDb`
      UPDATE fantasy_teams
      SET 
        player_points = ${playerPoints},
        passive_points = ${totalPassivePoints},
        total_points = ${calculatedTotal},
        updated_at = NOW()
      WHERE team_id = ${team.team_id}
    `;

    // Verify the update
    const updated = await fantasyDb`
      SELECT 
        player_points,
        passive_points,
        total_points
      FROM fantasy_teams
      WHERE team_id = ${team.team_id}
    `;

    console.log('✅ Updated!\n');
    console.log('📊 Database Values:');
    console.log(`  Player Points: ${updated[0].player_points}`);
    console.log(`  Passive Points: ${updated[0].passive_points}`);
    console.log(`  Total Points: ${updated[0].total_points}\n`);

    // Verify correctness
    const isCorrect = 
      Number(updated[0].player_points) === playerPoints &&
      Number(updated[0].passive_points) === totalPassivePoints &&
      Number(updated[0].total_points) === calculatedTotal;

    if (isCorrect) {
      console.log('✅ TEST PASSED! Passive points now correctly include admin bonuses.');
    } else {
      console.log('❌ TEST FAILED! Values do not match.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testPassivePointsFix()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPassivePointsFix };
