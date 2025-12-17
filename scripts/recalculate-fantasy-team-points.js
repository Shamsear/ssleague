const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function recalculateFantasyTeamPoints() {
  const sql = neon(process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL);

  try {
    console.log('🔄 Recalculating fantasy team total points...\n');

    // Get all fantasy teams
    const teams = await sql`
      SELECT team_id, team_name, league_id, total_points as old_total_points
      FROM fantasy_teams
      ORDER BY team_name
    `;

    console.log(`Found ${teams.length} fantasy teams\n`);

    const updates = [];

    for (const team of teams) {
      // Calculate total points from fantasy_player_points
      const pointsResult = await sql`
        SELECT COALESCE(SUM(total_points), 0) as player_points
        FROM fantasy_player_points
        WHERE team_id = ${team.team_id}
      `;

      // Get passive team points from fantasy_teams table
      const teamInfo = await sql`
        SELECT COALESCE(passive_points, 0) as passive_points
        FROM fantasy_teams
        WHERE team_id = ${team.team_id}
      `;

      const playerPoints = Number(pointsResult[0].player_points);
      const passivePoints = Number(teamInfo[0].passive_points);
      const calculatedTotal = playerPoints + passivePoints;
      const oldTotal = Number(team.old_total_points);

      // Update the team's total_points
      await sql`
        UPDATE fantasy_teams
        SET total_points = ${calculatedTotal}
        WHERE team_id = ${team.team_id}
      `;

      const difference = calculatedTotal - oldTotal;
      const status = difference === 0 ? '✓' : difference > 0 ? '↑' : '↓';

      updates.push({
        team: team.team_name,
        old: oldTotal,
        new: calculatedTotal,
        diff: difference,
        status
      });

      console.log(`${status} ${team.team_name}: ${oldTotal} → ${calculatedTotal} (${difference >= 0 ? '+' : ''}${difference}) [Players: ${playerPoints}, Passive: ${passivePoints}]`);
    }

    console.log('\n📊 Summary:');
    console.log(`Total teams updated: ${updates.length}`);
    console.log(`Teams with changes: ${updates.filter(u => u.diff !== 0).length}`);
    console.log(`Total points added: ${updates.reduce((sum, u) => sum + (u.diff > 0 ? u.diff : 0), 0)}`);
    console.log(`Total points removed: ${updates.reduce((sum, u) => sum + (u.diff < 0 ? Math.abs(u.diff) : 0), 0)}`);

    // Recalculate ranks for each league
    console.log('\n🏆 Recalculating ranks...');
    
    const leagues = await sql`
      SELECT DISTINCT league_id
      FROM fantasy_teams
    `;

    for (const league of leagues) {
      await sql`
        WITH ranked_teams AS (
          SELECT 
            team_id,
            ROW_NUMBER() OVER (ORDER BY total_points DESC, team_name ASC) as new_rank
          FROM fantasy_teams
          WHERE league_id = ${league.league_id}
        )
        UPDATE fantasy_teams ft
        SET rank = rt.new_rank
        FROM ranked_teams rt
        WHERE ft.team_id = rt.team_id
      `;
      console.log(`✓ Updated ranks for league ${league.league_id}`);
    }

    console.log('\n✅ Recalculation complete!');

    // Show top 10 teams
    console.log('\n🏆 Top 10 Teams:');
    const topTeams = await sql`
      SELECT rank, team_name, total_points, league_id
      FROM fantasy_teams
      ORDER BY total_points DESC
      LIMIT 10
    `;
    console.table(topTeams);

  } catch (error) {
    console.error('❌ Error recalculating points:', error);
    process.exit(1);
  }
}

recalculateFantasyTeamPoints();
