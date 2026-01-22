/**
 * Team Stats API - Tournament Database
 * GET: Fetch team statistics
 * POST: Update team statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);

    const seasonId = searchParams.get('seasonId');
    let tournamentId = searchParams.get('tournamentId');
    const teamId = searchParams.get('teamId');

    // Backward compatibility: If only seasonId provided, get primary tournament
    if (seasonId && !tournamentId) {
      const primaryTournament = await sql`
        SELECT id FROM tournaments 
        WHERE season_id = ${seasonId} AND is_primary = true
        LIMIT 1
      `;
      if (primaryTournament.length > 0) {
        tournamentId = primaryTournament[0].id;
      } else {
        // Fallback to LEAGUE tournament
        tournamentId = `${seasonId}-LEAGUE`;
      }
    }

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'tournamentId or seasonId is required' },
        { status: 400 }
      );
    }

    let stats;

    if (teamId) {
      stats = await sql`
        SELECT * FROM teamstats 
        WHERE team_id = ${teamId} AND tournament_id = ${tournamentId}
      `;
    } else {
      stats = await sql`
        SELECT * FROM teamstats 
        WHERE tournament_id = ${tournamentId}
        ORDER BY points DESC, goal_difference DESC, goals_for DESC
      `;
    }

    return NextResponse.json({
      success: true,
      data: stats,
      count: stats.length
    });

  } catch (error: any) {
    console.error('Error fetching team stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();

    const {
      team_id,
      season_id,
      tournament_id,
      team_name,
      matches_played = 0,
      wins = 0,
      draws = 0,
      losses = 0,
      goals_for = 0,
      goals_against = 0,
      goal_difference = 0,
      points = 0,
      position
    } = body;

    if (!team_id || !tournament_id || !team_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: team_id, tournament_id, team_name' },
        { status: 400 }
      );
    }

    const statsId = `${team_id}_${season_id}_${tournament_id}`;

    const result = await sql`
      INSERT INTO teamstats (
        id, team_id, season_id, tournament_id, team_name,
        matches_played, wins, draws, losses,
        goals_for, goals_against, goal_difference, points, position
      )
      VALUES (
        ${statsId}, ${team_id}, ${season_id}, ${tournament_id}, ${team_name},
        ${matches_played}, ${wins}, ${draws}, ${losses},
        ${goals_for}, ${goals_against}, ${goal_difference}, ${points}, ${position}
      )
      ON CONFLICT (team_id, season_id, tournament_id) DO UPDATE
      SET matches_played = EXCLUDED.matches_played,
          wins = EXCLUDED.wins,
          draws = EXCLUDED.draws,
          losses = EXCLUDED.losses,
          goals_for = EXCLUDED.goals_for,
          goals_against = EXCLUDED.goals_against,
          goal_difference = EXCLUDED.goal_difference,
          points = EXCLUDED.points,
          position = EXCLUDED.position,
          updated_at = NOW()
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: result[0]
    });

  } catch (error: any) {
    console.error('Error updating team stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
