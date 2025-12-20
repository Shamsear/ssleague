/**
 * Check Actual Database Values
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkActualValues() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Checking Actual Database Values...\n');

  try {
    // Get teams with admin bonuses
    const teams = await fantasyDb`
      SELECT 
        ft.team_id,
        ft.team_name,
        ft.owner_name,
        ft.supported_team_id,
        ft.player_points,
        ft.passive_points,
        ft.total_points
      FROM fantasy_teams ft
      WHERE ft.team_name IN ('Psychoz', 'FC Barcelona', 'Blue Strikers')
      ORDER BY ft.team_name
    `;

    console.log('📊 Current Database Values:\n');
    
    for (const team of teams) {
      console.log(`${team.team_name}:`);
      console.log(`  Player Points: ${team.player_points}`);
      console.log(`  Passive Points: ${team.passive_points}`);
      console.log(`  Total Points: ${team.total_points}`);
      console.log(`  Expected Total: ${Number(team.player_points) + Number(team.passive_points)}`);
      
      // Get breakdown
      const bonuses = await fantasyDb`
        SELECT COALESCE(SUM(total_bonus), 0) as team_bonus
        FROM fantasy_team_bonus_points
        WHERE team_id = ${team.team_id}
      `;
      
      const adminBonus = await fantasyDb`
        SELECT COALESCE(SUM(points), 0) as admin_bonus
        FROM bonus_points
        WHERE target_type = 'team'
          AND target_id = ${team.supported_team_id}
      `;
      
      console.log(`  Team Bonuses: ${bonuses[0].team_bonus}`);
      console.log(`  Admin Bonuses: ${adminBonus[0].admin_bonus}`);
      console.log(`  Expected Passive: ${Number(bonuses[0].team_bonus) + Number(adminBonus[0].admin_bonus)}`);
      
      const match = Number(team.passive_points) === (Number(bonuses[0].team_bonus) + Number(adminBonus[0].admin_bonus));
      console.log(`  Status: ${match ? '✅ CORRECT' : '❌ MISMATCH'}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkActualValues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
