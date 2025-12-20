import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id') || 'SSPSLS16';

    const sql = getTournamentDb();

    const players = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        season_id,
        team,
        points,
        base_points,
        matches_played,
        goals_scored,
        goals_conceded,
        (goals_scored - goals_conceded) as goal_difference,
        wins,
        draws,
        losses,
        clean_sheets,
        assists
      FROM player_seasons
      WHERE season_id = ${season_id}
      ORDER BY points DESC, goal_difference DESC, goals_scored DESC
    `;

    // Debug logging
    console.log('[Committee Player Stats API] Season:', season_id);
    console.log('[Committee Player Stats API] Total players:', players.length);
    if (players.length > 0) {
      console.log('[Committee Player Stats API] First player:', {
        player_id: players[0].player_id,
        player_name: players[0].player_name,
        points: players[0].points,
        base_points: players[0].base_points
      });
    }

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player stats' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      player_id,
      points,
      base_points,
      matches_played,
      goals_scored,
      goals_conceded,
      wins,
      draws,
      losses,
      clean_sheets,
      assists
    } = body;

    if (!player_id) {
      return NextResponse.json(
        { error: 'player_id is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    await sql`
      UPDATE player_seasons
      SET
        points = ${points},
        base_points = ${base_points},
        matches_played = ${matches_played},
        goals_scored = ${goals_scored},
        goals_conceded = ${goals_conceded},
        wins = ${wins},
        draws = ${draws},
        losses = ${losses},
        clean_sheets = ${clean_sheets},
        assists = ${assists},
        updated_at = NOW()
      WHERE id = ${player_id}
    `;

    console.log('[Committee Player Stats API] Updated player:', player_id, 'base_points:', base_points);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating player stats:', error);
    return NextResponse.json(
      { error: 'Failed to update player stats' },
      { status: 500 }
    );
  }
}
