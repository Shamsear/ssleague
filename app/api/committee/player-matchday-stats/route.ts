import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const player_id = searchParams.get('player_id');
    const season_id = searchParams.get('season_id') || 'SSPSLS16';

    if (!player_id) {
      return NextResponse.json(
        { error: 'player_id is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // First, get the actual player_id from player_seasons (not the composite id)
    const playerInfo = await sql`
      SELECT player_id, player_name
      FROM player_seasons
      WHERE id = ${player_id}
      LIMIT 1
    `;

    if (playerInfo.length === 0) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const actualPlayerId = playerInfo[0].player_id;

    // Get matchday-by-matchday stats for the player using the actual player_id
    // This query handles substitutions by checking both current and original player IDs
    const matchdayStats = await sql`
      WITH player_matches AS (
        SELECT 
          m.fixture_id,
          m.round_number,
          m.home_player_id,
          m.away_player_id,
          m.home_original_player_id,
          m.away_original_player_id,
          m.home_substituted,
          m.away_substituted,
          m.home_goals,
          m.away_goals,
          m.home_player_name,
          m.away_player_name,
          m.home_original_player_name,
          m.away_original_player_name,
          f.home_team_name,
          f.away_team_name,
          f.status,
          CASE 
            -- Check if player is the current home player (either started or subbed in)
            WHEN m.home_player_id = ${actualPlayerId} THEN 'home'
            -- Check if player is the current away player (either started or subbed in)
            WHEN m.away_player_id = ${actualPlayerId} THEN 'away'
            -- Check if player was the original home player but got subbed out
            WHEN m.home_original_player_id = ${actualPlayerId} AND m.home_substituted = true THEN NULL
            -- Check if player was the original away player but got subbed out
            WHEN m.away_original_player_id = ${actualPlayerId} AND m.away_substituted = true THEN NULL
          END as player_side,
          CASE 
            WHEN m.home_player_id = ${actualPlayerId} THEN m.home_goals
            WHEN m.away_player_id = ${actualPlayerId} THEN m.away_goals
          END as goals_scored,
          CASE 
            WHEN m.home_player_id = ${actualPlayerId} THEN m.away_goals
            WHEN m.away_player_id = ${actualPlayerId} THEN m.home_goals
          END as goals_conceded,
          CASE
            -- Show if player was a substitute
            WHEN m.home_player_id = ${actualPlayerId} AND m.home_substituted = true THEN true
            WHEN m.away_player_id = ${actualPlayerId} AND m.away_substituted = true THEN true
            ELSE false
          END as was_substitute
        FROM matchups m
        JOIN fixtures f ON m.fixture_id = f.id
        WHERE m.season_id = ${season_id}
        AND (
          m.home_player_id = ${actualPlayerId} 
          OR m.away_player_id = ${actualPlayerId}
        )
        AND f.status = 'completed'
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      )
      SELECT 
        round_number as matchday,
        fixture_id,
        player_side,
        home_team_name,
        away_team_name,
        home_player_name,
        away_player_name,
        goals_scored,
        goals_conceded,
        (goals_scored - goals_conceded) as goal_difference,
        CASE 
          WHEN (goals_scored - goals_conceded) > 5 THEN 5
          WHEN (goals_scored - goals_conceded) < -5 THEN -5
          ELSE (goals_scored - goals_conceded)
        END as points,
        was_substitute
      FROM player_matches
      WHERE player_side IS NOT NULL
      ORDER BY round_number ASC
    `;

    // Calculate total points
    const totalPoints = matchdayStats.reduce((sum: number, match: any) => sum + (match.points || 0), 0);

    return NextResponse.json({ 
      matchdayStats,
      totalPoints,
      matchesPlayed: matchdayStats.length
    });
  } catch (error) {
    console.error('Error fetching player matchday stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player matchday stats' },
      { status: 500 }
    );
  }
}
