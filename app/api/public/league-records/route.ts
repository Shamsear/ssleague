import { NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export const revalidate = 300; // Cache for 5 minutes

/**
 * GET /api/public/league-records
 * Returns league records (highest/best values)
 */
export async function GET() {
  try {
    const sql = getTournamentDb();
    
    // Highest Points in a Season (Team)
    const [highestPoints] = await sql`
      SELECT team_name, points, season_id, wins, matches_played
      FROM teamstats
      ORDER BY points DESC
      LIMIT 1
    `;
    
    // Most Goals in a Season (Team)
    const [mostTeamGoals] = await sql`
      SELECT team_name, goals_for as goals, season_id, matches_played
      FROM teamstats
      ORDER BY goals_for DESC
      LIMIT 1
    `;
    
    // Best Goal Difference (Team)
    const [bestGoalDiff] = await sql`
      SELECT team_name, goal_difference, goals_for, goals_against, season_id
      FROM teamstats
      ORDER BY goal_difference DESC
      LIMIT 1
    `;
    
    // Longest Win Streak (Team)
    const [longestWinStreak] = await sql`
      SELECT team_name, win_streak, season_id
      FROM teamstats
      WHERE win_streak > 0
      ORDER BY win_streak DESC
      LIMIT 1
    `;
    
    // Most Goals by Player in a Season
    const [mostPlayerGoals] = await sql`
      SELECT player_name, goals_scored, season_id, matches_played, team
      FROM realplayerstats
      ORDER BY goals_scored DESC
      LIMIT 1
    `;
    
    // Most Assists by Player in a Season
    const [mostPlayerAssists] = await sql`
      SELECT player_name, assists, season_id, matches_played, team
      FROM realplayerstats
      ORDER BY assists DESC
      LIMIT 1
    `;
    
    // Most Clean Sheets by Player in a Season
    const [mostCleanSheets] = await sql`
      SELECT player_name, clean_sheets, season_id, matches_played, team
      FROM realplayerstats
      ORDER BY clean_sheets DESC
      LIMIT 1
    `;
    
    // Most Points by Player in a Season
    const [mostPlayerPoints] = await sql`
      SELECT player_name, points, season_id, matches_played, team
      FROM realplayerstats
      ORDER BY points DESC
      LIMIT 1
    `;
    
    // Unbeaten Streak (Team)
    const [unbeatenStreak] = await sql`
      SELECT team_name, unbeaten_streak, season_id
      FROM teamstats
      WHERE unbeaten_streak > 0
      ORDER BY unbeaten_streak DESC
      LIMIT 1
    `;
    
    return NextResponse.json({
      success: true,
      data: {
        team: {
          highestPoints,
          mostGoals: mostTeamGoals,
          bestGoalDifference: bestGoalDiff,
          longestWinStreak,
          unbeatenStreak
        },
        player: {
          mostGoals: mostPlayerGoals,
          mostAssists: mostPlayerAssists,
          mostCleanSheets,
          mostPoints: mostPlayerPoints
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching league records:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
