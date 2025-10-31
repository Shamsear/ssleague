import { NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export const revalidate = 300; // Cache for 5 minutes

/**
 * GET /api/public/league-stats
 * Returns overall league statistics across all seasons
 */
export async function GET() {
  try {
    const sql = getTournamentDb();
    
    // Get overall league statistics
    const [leagueStats] = await sql`
      SELECT 
        COUNT(DISTINCT season_id) as total_seasons,
        COUNT(DISTINCT team_id) as total_teams,
        SUM(matches_played) / 2 as total_matches,
        SUM(goals_for) as total_goals,
        SUM(wins) as total_wins,
        SUM(draws) as total_draws,
        SUM(losses) as total_losses
      FROM teamstats
    `;
    
    // Get player statistics
    const [playerStats] = await sql`
      SELECT 
        COUNT(DISTINCT player_id) as total_players,
        SUM(goals_scored) as total_player_goals,
        SUM(assists) as total_assists,
        SUM(clean_sheets) as total_clean_sheets
      FROM realplayerstats
    `;
    
    // Get trophy count
    const [trophyStats] = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE trophy_type = 'league') as league_titles_awarded,
        COUNT(*) FILTER (WHERE trophy_type = 'cup') as cup_titles_awarded,
        COUNT(DISTINCT team_id) as teams_with_trophies
      FROM team_trophies
    `;
    
    return NextResponse.json({
      success: true,
      data: {
        league: {
          total_seasons: parseInt(leagueStats.total_seasons) || 0,
          total_teams: parseInt(leagueStats.total_teams) || 0,
          total_matches: parseInt(leagueStats.total_matches) || 0,
          total_goals: parseInt(leagueStats.total_goals) || 0,
          total_wins: parseInt(leagueStats.total_wins) || 0,
          total_draws: parseInt(leagueStats.total_draws) || 0,
          total_losses: parseInt(leagueStats.total_losses) || 0,
        },
        players: {
          total_players: parseInt(playerStats.total_players) || 0,
          total_goals: parseInt(playerStats.total_player_goals) || 0,
          total_assists: parseInt(playerStats.total_assists) || 0,
          total_clean_sheets: parseInt(playerStats.total_clean_sheets) || 0,
        },
        trophies: {
          league_titles: parseInt(trophyStats.league_titles_awarded) || 0,
          cup_titles: parseInt(trophyStats.cup_titles_awarded) || 0,
          teams_with_trophies: parseInt(trophyStats.teams_with_trophies) || 0,
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching league stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
