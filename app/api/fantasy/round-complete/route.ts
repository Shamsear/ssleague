import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb, getTournamentDb } from '@/lib/neon/fantasy-config';
import { triggerNews } from '@/lib/news/trigger';

/**
 * POST /api/fantasy/round-complete
 * Trigger fantasy round completion news with standings tables
 * Called manually by committee or automatically after last fixture of round
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, round_number } = body;

    if (!season_id || round_number === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: season_id, round_number' },
        { status: 400 }
      );
    }

    const fantasyDb = getFantasyDb();
    const tournamentDb = getTournamentDb();

    // Get fantasy league for this season
    const leagues = await fantasyDb`
      SELECT id, league_id, league_name, season_name
      FROM fantasy_leagues
      WHERE season_id = ${season_id}
        AND is_active = true
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active fantasy league found for this season',
      });
    }

    const league = leagues[0];
    const fantasy_league_id = league.league_id;

    // Get TOP 10 fantasy teams standings
    const teamStandings = await fantasyDb`
      SELECT 
        ft.team_id,
        ft.team_name,
        ft.manager_name,
        ft.player_points,
        ft.bonus_points,
        ft.total_points,
        ft.rank
      FROM fantasy_teams ft
      WHERE ft.league_id = ${fantasy_league_id}
      ORDER BY ft.total_points DESC, ft.team_id ASC
      LIMIT 10
    `;

    // Get TOP 10 real players by fantasy points
    const playerStandings = await fantasyDb`
      SELECT 
        fp.real_player_id,
        fp.player_name,
        fp.total_points,
        fp.goals_scored,
        fp.assists,
        COUNT(DISTINCT fpp.fixture_id) as matches_played
      FROM fantasy_players fp
      LEFT JOIN fantasy_player_points fpp 
        ON fp.real_player_id = fpp.real_player_id 
        AND fp.league_id = fpp.league_id
      WHERE fp.league_id = ${fantasy_league_id}
      GROUP BY fp.real_player_id, fp.player_name, fp.total_points, fp.goals_scored, fp.assists
      ORDER BY fp.total_points DESC
      LIMIT 10
    `;

    // Format team standings table
    const teamTable = teamStandings.map((team, index) => ({
      rank: index + 1,
      team_name: team.team_name,
      manager: team.manager_name,
      points: team.total_points,
      player_pts: team.player_points,
      bonus_pts: team.bonus_points || 0,
    }));

    // Format player standings table
    const playerTable = playerStandings.map((player, index) => ({
      rank: index + 1,
      player_name: player.player_name,
      points: player.total_points,
      goals: player.goals_scored || 0,
      assists: player.assists || 0,
      matches: player.matches_played || 0,
    }));

    // Trigger news generation with standings data
    await triggerNews('fantasy_standings_update', {
      season_id,
      season_name: league.season_name,
      league_name: league.league_name,
      round_number,
      team_standings: teamTable,
      player_standings: playerTable,
      context: `Round ${round_number} fantasy standings with top 10 teams and top 10 performing real players`,
    });

    console.log(`📰 Fantasy round ${round_number} standings news triggered`);

    return NextResponse.json({
      success: true,
      message: `Fantasy round ${round_number} standings news generated`,
      team_standings: teamTable,
      player_standings: playerTable,
    });
  } catch (error) {
    console.error('Error generating fantasy round standings news:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate fantasy standings news',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
