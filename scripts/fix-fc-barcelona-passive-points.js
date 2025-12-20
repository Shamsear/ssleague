/**
 * Fix FC Barcelona Fantasy Team Passive Points
 * 
 * This script checks and fixes the passive points calculation for FC Barcelona fantasy team
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixFCBarcelonaPassivePoints() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Checking FC Barcelona Fantasy Team Passive Points...\n');

  try {
    // Find FC Barcelona fantasy team
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
      WHERE team_name ILIKE '%barcelona%'
      ORDER BY team_name
    `;

    if (teams.length === 0) {
      console.log('❌ No FC Barcelona fantasy team found');
      return;
    }

    console.log(`✅ Found ${teams.length} team(s):\n`);
    teams.forEach((team, i) => {
      console.log(`${i + 1}. ${team.team_name} (Owner: ${team.owner_name})`);
      console.log(`   Team ID: ${team.team_id}`);
      console.log(`   Supported Team: ${team.supported_team_name} (${team.supported_team_id})`);
      console.log(`   Current Passive Points: ${team.passive_points}`);
      console.log(`   Player Points: ${team.player_points}`);
      console.log(`   Total Points: ${team.total_points}`);
      console.log('');
    });

    // Check each team
    for (const team of teams) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Analyzing: ${team.team_name}`);
      console.log(`${'='.repeat(80)}\n`);

      // 1. Get passive bonus points from fantasy_team_bonus_points
      const bonusPoints = await fantasyDb`
        SELECT 
          fixture_id,
          round_number,
          real_team_name,
          bonus_breakdown,
          total_bonus,
          calculated_at
        FROM fantasy_team_bonus_points
        WHERE team_id = ${team.team_id}
        ORDER BY round_number
      `;

      console.log(`📊 Passive Bonus Points (from fantasy_team_bonus_points):`);
      let totalPassiveBonus = 0;
      bonusPoints.forEach(bonus => {
        totalPassiveBonus += Number(bonus.total_bonus);
        let breakdown = bonus.bonus_breakdown;
        if (typeof breakdown === 'string') {
          try {
            breakdown = JSON.parse(breakdown);
          } catch (e) {
            breakdown = {};
          }
        }
        console.log(`  Round ${bonus.round_number}: +${bonus.total_bonus} pts`);
        Object.entries(breakdown).forEach(([key, value]) => {
          console.log(`    - ${key}: +${value}`);
        });
      });
      console.log(`  TOTAL from bonuses: ${totalPassiveBonus} pts\n`);

      // 2. Get admin bonus points
      const adminBonuses = await fantasyDb`
        SELECT 
          id,
          points,
          reason,
          awarded_by,
          awarded_at
        FROM bonus_points
        WHERE target_type = 'team'
          AND target_id = ${team.supported_team_id}
          AND league_id = ${team.league_id}
        ORDER BY awarded_at
      `;

      console.log(`🎁 Admin Bonus Points (from bonus_points):`);
      let totalAdminBonus = 0;
      if (adminBonuses.length === 0) {
        console.log(`  (none)\n`);
      } else {
        adminBonuses.forEach(bonus => {
          totalAdminBonus += Number(bonus.points);
          console.log(`  ${bonus.reason}: ${bonus.points > 0 ? '+' : ''}${bonus.points} pts (awarded ${new Date(bonus.awarded_at).toLocaleDateString()})`);
        });
        console.log(`  TOTAL from admin bonuses: ${totalAdminBonus} pts\n`);
      }

      // 3. Calculate expected passive points
      const expectedPassivePoints = totalPassiveBonus + totalAdminBonus;
      const currentPassivePoints = Number(team.passive_points);
      const difference = expectedPassivePoints - currentPassivePoints;

      console.log(`📈 Summary:`);
      console.log(`  Passive Bonuses: ${totalPassiveBonus}`);
      console.log(`  Admin Bonuses: ${totalAdminBonus}`);
      console.log(`  Expected Passive Points: ${expectedPassivePoints}`);
      console.log(`  Current Passive Points: ${currentPassivePoints}`);
      console.log(`  Difference: ${difference > 0 ? '+' : ''}${difference}\n`);

      if (difference !== 0) {
        console.log(`⚠️  MISMATCH DETECTED! Fixing...`);
        
        // Update passive points
        await fantasyDb`
          UPDATE fantasy_teams
          SET 
            passive_points = ${expectedPassivePoints},
            total_points = player_points + ${expectedPassivePoints},
            updated_at = NOW()
          WHERE team_id = ${team.team_id}
        `;

        // Verify the update
        const updated = await fantasyDb`
          SELECT passive_points, total_points
          FROM fantasy_teams
          WHERE team_id = ${team.team_id}
        `;

        console.log(`✅ Updated!`);
        console.log(`  New Passive Points: ${updated[0].passive_points}`);
        console.log(`  New Total Points: ${updated[0].total_points}\n`);
      } else {
        console.log(`✅ Passive points are correct!\n`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ Analysis Complete!');
    console.log(`${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  fixFCBarcelonaPassivePoints()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixFCBarcelonaPassivePoints };
