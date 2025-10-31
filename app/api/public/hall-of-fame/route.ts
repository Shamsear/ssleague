import { NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export const revalidate = 300; // Cache for 5 minutes

/**
 * GET /api/public/hall-of-fame
 * Returns all-time player records across all seasons
 */
export async function GET() {
  try {
    const sql = getTournamentDb();
    
    // Top Scorers (All-Time)
    const topScorers = await sql`
      SELECT 
        player_id,
        player_name,
        SUM(goals_scored) as total_goals,
        SUM(matches_played) as total_matches,
        COUNT(DISTINCT season_id) as seasons_played,
        ROUND(SUM(goals_scored)::numeric / NULLIF(SUM(matches_played), 0), 2) as goals_per_game
      FROM realplayerstats
      GROUP BY player_id, player_name
      HAVING SUM(goals_scored) > 0
      ORDER BY total_goals DESC
      LIMIT 10
    `;
    
    // Top Assist Providers
    const topAssisters = await sql`
      SELECT 
        player_id,
        player_name,
        SUM(assists) as total_assists,
        SUM(matches_played) as total_matches,
        COUNT(DISTINCT season_id) as seasons_played
      FROM realplayerstats
      GROUP BY player_id, player_name
      HAVING SUM(assists) > 0
      ORDER BY total_assists DESC
      LIMIT 10
    `;
    
    // Clean Sheet Kings
    const cleanSheetKings = await sql`
      SELECT 
        player_id,
        player_name,
        SUM(clean_sheets) as total_clean_sheets,
        SUM(matches_played) as total_matches,
        COUNT(DISTINCT season_id) as seasons_played
      FROM realplayerstats
      GROUP BY player_id, player_name
      HAVING SUM(clean_sheets) > 0
      ORDER BY total_clean_sheets DESC
      LIMIT 10
    `;
    
    // Most Appearances
    const mostAppearances = await sql`
      SELECT 
        player_id,
        player_name,
        SUM(matches_played) as total_matches,
        SUM(wins) as total_wins,
        COUNT(DISTINCT season_id) as seasons_played,
        SUM(goals_scored) as total_goals
      FROM realplayerstats
      GROUP BY player_id, player_name
      ORDER BY total_matches DESC
      LIMIT 10
    `;
    
    // Most Points
    const mostPoints = await sql`
      SELECT 
        player_id,
        player_name,
        SUM(points) as total_points,
        SUM(matches_played) as total_matches,
        COUNT(DISTINCT season_id) as seasons_played
      FROM realplayerstats
      GROUP BY player_id, player_name
      HAVING SUM(points) > 0
      ORDER BY total_points DESC
      LIMIT 10
    `;
    
    // Best Win Rate (minimum 20 matches)
    const bestWinRate = await sql`
      SELECT 
        player_id,
        player_name,
        SUM(wins) as total_wins,
        SUM(matches_played) as total_matches,
        ROUND((SUM(wins)::numeric / NULLIF(SUM(matches_played), 0)) * 100, 1) as win_rate,
        COUNT(DISTINCT season_id) as seasons_played
      FROM realplayerstats
      GROUP BY player_id, player_name
      HAVING SUM(matches_played) >= 20
      ORDER BY win_rate DESC
      LIMIT 10
    `;
    
    return NextResponse.json({
      success: true,
      data: {
        topScorers,
        topAssisters,
        cleanSheetKings,
        mostAppearances,
        mostPoints,
        bestWinRate
      }
    });
  } catch (error: any) {
    console.error('Error fetching Hall of Fame:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
