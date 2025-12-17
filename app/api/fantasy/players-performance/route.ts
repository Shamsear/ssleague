import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/fantasy/players-performance?league_id=xxx
 * Get all players with their fantasy performance (base points without multipliers)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id query parameter is required' },
        { status: 400 }
      );
    }

    // Get fantasy league info
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    const league = leagues[0];
    const tournamentSql = getTournamentDb();

    // Get all players from player_seasons for this season
    const allPlayers = await tournamentSql`
      SELECT 
        player_id,
        player_name,
        team as real_team_name,
        team_id,
        category,
        star_rating
      FROM player_seasons
      WHERE season_id = ${league.season_id}
        AND player_name IS NOT NULL
        AND team IS NOT NULL
        AND team != ''
      ORDER BY player_name ASC
    `;

    // Get fantasy points aggregated by player (base points without captain/vc multipliers)
    // Calculate base points by dividing total_points by multiplier (2 for captain, 1.5 for vc, 1 for regular)
    const fantasyPoints = await fantasySql`
      SELECT 
        real_player_id,
        COUNT(DISTINCT round_number) as matches_played,
        SUM(
          CASE 
            WHEN is_captain THEN total_points / 2
            WHEN is_vice_captain THEN total_points / 1.5
            ELSE total_points
          END
        ) as total_base_points,
        SUM(goals_scored) as total_goals,
        SUM(CASE WHEN is_clean_sheet THEN 1 ELSE 0 END) as clean_sheets,
        SUM(CASE WHEN is_motm THEN 1 ELSE 0 END) as motm_count
      FROM fantasy_player_points
      WHERE league_id = ${league_id}
      GROUP BY real_player_id
    `;

    // Create a map for quick lookup
    const pointsMap = new Map();
    fantasyPoints.forEach((p: any) => {
      pointsMap.set(p.real_player_id, {
        total_base_points: Number(p.total_base_points) || 0,
        matches_played: Number(p.matches_played) || 0,
        total_goals: Number(p.total_goals) || 0,
        clean_sheets: Number(p.clean_sheets) || 0,
        motm_count: Number(p.motm_count) || 0,
      });
    });

    // Combine player info with fantasy stats - only include active players (with matches played)
    const playersWithStats = allPlayers
      .map((player: any) => {
        const stats = pointsMap.get(player.player_id);
        
        // Skip players with no fantasy points data
        if (!stats) return null;

        const average_points =
          stats.matches_played > 0
            ? Math.round((stats.total_base_points / stats.matches_played) * 10) / 10
            : 0;

        return {
          real_player_id: player.player_id,
          player_name: player.player_name,
          real_team_name: player.real_team_name,
          category: player.category || 'Classic',
          star_rating: player.star_rating || 5,
          total_base_points: stats.total_base_points,
          matches_played: stats.matches_played,
          average_points: average_points,
          goals: stats.total_goals,
          clean_sheets: stats.clean_sheets,
          motm_count: stats.motm_count,
        };
      })
      .filter((player) => player !== null); // Remove null entries

    // Sort by total base points (highest first)
    playersWithStats.sort((a, b) => b.total_base_points - a.total_base_points);

    return NextResponse.json({
      success: true,
      players: playersWithStats,
      total_players: playersWithStats.length,
    });
  } catch (error) {
    console.error('Error fetching players performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch players performance', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
