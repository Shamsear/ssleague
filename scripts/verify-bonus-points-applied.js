const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function verify() {
  console.log('🔍 Verifying Admin Bonus Points Were Applied\n');

  // Get teams that received bonuses
  const bonuses = await fantasyDb`
    SELECT target_id, points, reason
    FROM bonus_points
    WHERE target_type = 'team'
  `;

  console.log('Admin Bonuses Awarded:');
  for (const bonus of bonuses) {
    console.log(`\n${bonus.target_id}: +${bonus.points} pts (${bonus.reason})`);
    
    const team = await fantasyDb`
      SELECT 
        team_name,
        total_points,
        player_points,
        passive_points
      FROM fantasy_teams
      WHERE team_id = ${bonus.target_id}
    `;

    if (team.length > 0) {
      const t = team[0];
      const calculatedWithoutBonus = t.player_points + t.passive_points;
      const bonusIncluded = t.total_points - calculatedWithoutBonus;
      
      console.log(`  Team: ${t.team_name}`);
      console.log(`  Player Points: ${t.player_points}`);
      console.log(`  Passive Points: ${t.passive_points}`);
      console.log(`  Calculated (player + passive): ${calculatedWithoutBonus}`);
      console.log(`  Total Points: ${t.total_points}`);
      console.log(`  Bonus Included: ${bonusIncluded}`);
      console.log(`  Expected Bonus: ${bonus.points}`);
      console.log(`  ${bonusIncluded === bonus.points ? '✅ CORRECT' : '❌ MISMATCH'}`);
    }
  }
}

verify().then(() => process.exit(0));
