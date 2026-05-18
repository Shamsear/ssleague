import { getTournamentDb } from './tournament-config';

/**
 * Recalculate and update positions for all teams in a specific tournament within a season
 * Teams are ranked by: (points - points_deducted) DESC, goal_difference DESC, goals_for DESC
 */
export async function recalculatePositions(season_id: string, tournament_id: string) {
  const sql = getTournamentDb();

  // Get all teams in this tournament and season, ordered by ranking criteria
  const teams = await sql`
    SELECT id, points, COALESCE(points_deducted, 0) as points_deducted, goal_difference, goals_for
    FROM teamstats
    WHERE season_id = ${season_id}
      AND tournament_id = ${tournament_id}
    ORDER BY 
      (points - COALESCE(points_deducted, 0)) DESC,
      goal_difference DESC,
      goals_for DESC
  `;

  // Update each team's position
  for (let i = 0; i < teams.length; i++) {
    const position = i + 1;
    await sql`
      UPDATE teamstats
      SET position = ${position}
      WHERE id = ${teams[i].id}
    `;
  }

  console.log(`✓ Recalculated positions for ${teams.length} teams in tournament ${tournament_id}, season ${season_id}`);
}
