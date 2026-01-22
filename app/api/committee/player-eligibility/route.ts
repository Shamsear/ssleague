import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const fromRound = parseInt(searchParams.get('from_round') || '1');
    const toRound = parseInt(searchParams.get('to_round') || '10');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Get all active player_seasons for the season
    const playerSeasons = await sql`
      SELECT 
        ps.id,
        ps.player_id,
        ps.player_name,
        ps.team_id,
        ps.team as team_name,
        ps.season_id,
        ps.category,
        ps.star_rating
      FROM player_seasons ps
      WHERE ps.season_id = ${seasonId}
        AND ps.status = 'active'
      ORDER BY ps.team, ps.player_name
    `;

    // For each player, calculate stats from matchups in the round range
    const playersWithStats = await Promise.all(
      playerSeasons.map(async (player) => {
        const stats = await sql`
          WITH home_matches AS (
            SELECT 
              m.home_player_id as player_id,
              COUNT(*) as matches,
              SUM(CASE WHEN m.home_goals > m.away_goals THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN m.home_goals = m.away_goals THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN m.home_goals < m.away_goals THEN 1 ELSE 0 END) as losses,
              SUM(COALESCE(m.home_goals, 0)) as goals_scored,
              SUM(COALESCE(m.away_goals, 0)) as goals_conceded,
              SUM(CASE WHEN COALESCE(m.away_goals, 0) = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups m
            JOIN fixtures f ON m.fixture_id = f.id
            WHERE m.home_player_id = ${player.player_id}
              AND m.season_id = ${seasonId}
              AND m.home_goals IS NOT NULL
              AND m.away_goals IS NOT NULL
              AND f.round_number >= ${fromRound}
              AND f.round_number <= ${toRound}
            GROUP BY m.home_player_id
          ),
          away_matches AS (
            SELECT 
              m.away_player_id as player_id,
              COUNT(*) as matches,
              SUM(CASE WHEN m.away_goals > m.home_goals THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN m.away_goals = m.home_goals THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN m.away_goals < m.home_goals THEN 1 ELSE 0 END) as losses,
              SUM(COALESCE(m.away_goals, 0)) as goals_scored,
              SUM(COALESCE(m.home_goals, 0)) as goals_conceded,
              SUM(CASE WHEN COALESCE(m.home_goals, 0) = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups m
            JOIN fixtures f ON m.fixture_id = f.id
            WHERE m.away_player_id = ${player.player_id}
              AND m.season_id = ${seasonId}
              AND m.home_goals IS NOT NULL
              AND m.away_goals IS NOT NULL
              AND f.round_number >= ${fromRound}
              AND f.round_number <= ${toRound}
            GROUP BY m.away_player_id
          )
          SELECT 
            COALESCE(h.matches, 0) + COALESCE(a.matches, 0) as total_matches,
            COALESCE(h.wins, 0) + COALESCE(a.wins, 0) as total_wins,
            COALESCE(h.draws, 0) + COALESCE(a.draws, 0) as total_draws,
            COALESCE(h.losses, 0) + COALESCE(a.losses, 0) as total_losses,
            COALESCE(h.goals_scored, 0) + COALESCE(a.goals_scored, 0) as total_goals_scored,
            COALESCE(h.goals_conceded, 0) + COALESCE(a.goals_conceded, 0) as total_goals_conceded,
            COALESCE(h.clean_sheets, 0) + COALESCE(a.clean_sheets, 0) as total_clean_sheets
          FROM (SELECT 1) dummy
          LEFT JOIN home_matches h ON true
          LEFT JOIN away_matches a ON true
        `;

        const matchStats = stats[0];

        return {
          id: player.id,
          player_id: player.player_id,
          player_name: player.player_name,
          team_id: player.team_id,
          team_name: player.team_name || 'Unknown Team',
          season_id: player.season_id,
          category: player.category,
          star_rating: player.star_rating,
          matches_played: parseInt(matchStats.total_matches) || 0,
          wins: parseInt(matchStats.total_wins) || 0,
          draws: parseInt(matchStats.total_draws) || 0,
          losses: parseInt(matchStats.total_losses) || 0,
          goals_scored: parseInt(matchStats.total_goals_scored) || 0,
          goals_conceded: parseInt(matchStats.total_goals_conceded) || 0,
          goal_difference: (parseInt(matchStats.total_goals_scored) || 0) - (parseInt(matchStats.total_goals_conceded) || 0),
          clean_sheets: parseInt(matchStats.total_clean_sheets) || 0,
          points: 0
        };
      })
    );

    // Get max round for the season
    const maxRoundResult = await sql`
      SELECT MAX(round_number) as max_round
      FROM fixtures
      WHERE season_id = ${seasonId}
    `;

    const maxRound = maxRoundResult[0]?.max_round || 10;

    return NextResponse.json({
      players: playersWithStats,
      maxRound,
      fromRound,
      toRound
    });

  } catch (error: any) {
    console.error('Error fetching player eligibility:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player eligibility data', details: error.message },
      { status: 500 }
    );
  }
}