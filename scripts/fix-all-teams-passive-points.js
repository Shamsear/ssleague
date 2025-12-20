/**
 * Fix All Teams' Passive Points
 * 
 * This script recalculates passive points for ALL fantasy teams
 * to include both team bonuses and admin bonuses
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixAllTeamsPassivePoints() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔧 Fixing Passive Points for All Fantasy Teams...\n');
  console.log('='.repeat(80));

  try {
    // Get all fantasy teams
    const teams = await fantasyDb`
      SELECT 
        team_id,
        team_name,
        owner_name,
        supported_team_id,
        supported_team_name,
        passive_points,
        player_points,
        total_points,
        league_id
      FROM fantasy_teams
      ORDER BY team_name
    `;

    console.log(`\n✅ Found ${teams.length} fantasy teams\n`);

    let teamsFixed = 0;
    let teamsCorrect = 0;
    let totalDifference = 0;

    for (const team of teams) {
      // Get passive bonus points from fantasy_team_bonus_points
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

      // Get player points
      const playerPointsResult = await fantasyDb`
        SELECT COALESCE(SUM(total_points), 0) as player_points
        FROM fantasy_player_points
        WHERE team_id = ${team.team_id}
      `;

      const passiveBonusPoints = Number(bonusPointsResult[0].passive_bonus);
      const adminBonusPoints = Number(adminBonusResult[0].admin_bonus);
      const playerPoints = Number(playerPointsResult[0].player_points);
      const expectedPassivePoints = passiveBonusPoints + adminBonusPoints;
      const expectedTotalPoints = playerPoints + expectedPassivePoints;
      
      const currentPassivePoints = Number(team.passive_points);
      const difference = expectedPassivePoints - currentPassivePoints;

      if (difference !== 0) {
        console.log(`\n🔧 ${team.team_name} (${team.owner_name})`);
        console.log(`   Supported Team: ${team.supported_team_name || 'None'}`);
        console.log(`   Passive Bonuses: ${passiveBonusPoints}`);
        console.log(`   Admin Bonuses: ${adminBonusPoints}`);
        console.log(`   Current Passive: ${currentPassivePoints}`);
        console.log(`   Expected Passive: ${expectedPassivePoints}`);
        console.log(`   Difference: ${difference > 0 ? '+' : ''}${difference}`);

        // Update the team
        await fantasyDb`
          UPDATE fantasy_teams
          SET 
            player_points = ${playerPoints},
            passive_points = ${expectedPassivePoints},
            total_points = ${expectedTotalPoints},
            updated_at = NOW()
          WHERE team_id = ${team.team_id}
        `;

        console.log(`   ✅ Fixed!`);
        teamsFixed++;
        totalDifference += Math.abs(difference);
      } else {
        teamsCorrect++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Total Teams: ${teams.length}`);
    console.log(`   Teams Fixed: ${teamsFixed}`);
    console.log(`   Teams Already Correct: ${teamsCorrect}`);
    console.log(`   Total Points Adjusted: ${totalDifference}`);

    if (teamsFixed > 0) {
      console.log('\n✅ All teams have been updated!');
      console.log('   Passive points now correctly include admin bonuses.');
    } else {
      console.log('\n✅ All teams were already correct!');
    }

    // Show teams with admin bonuses
    const teamsWithAdminBonus = await fantasyDb`
      SELECT 
        ft.team_name,
        ft.owner_name,
        ft.passive_points,
        COALESCE(SUM(bp.points), 0) as admin_bonus
      FROM fantasy_teams ft
      LEFT JOIN bonus_points bp 
        ON bp.target_type = 'team'
        AND bp.target_id = ft.supported_team_id
        AND bp.league_id = ft.league_id
      GROUP BY ft.team_id, ft.team_name, ft.owner_name, ft.passive_points
      HAVING COALESCE(SUM(bp.points), 0) > 0
      ORDER BY admin_bonus DESC
    `;

    if (teamsWithAdminBonus.length > 0) {
      console.log('\n🎁 Teams with Admin Bonuses:');
      teamsWithAdminBonus.forEach(t => {
        console.log(`   ${t.team_name}: +${t.admin_bonus} admin bonus (Total Passive: ${t.passive_points})`);
      });
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  fixAllTeamsPassivePoints()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllTeamsPassivePoints };
