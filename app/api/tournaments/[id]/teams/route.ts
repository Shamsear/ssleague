import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Get teams participating in a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Get tournament details to get season_id
    const tournament = await sql`
      SELECT season_id FROM tournaments WHERE id = ${tournamentId} LIMIT 1
    `;

    if (tournament.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const seasonId = tournament[0].season_id;

    // Get all teams for this season with their tournament assignment status
    const teams = await sql`
      SELECT 
        team_id,
        team_name,
        tournament_id,
        CASE WHEN tournament_id = ${tournamentId} THEN true ELSE false END as is_participating
      FROM teamstats
      WHERE season_id = ${seasonId}
      ORDER BY team_name ASC
    `;

    return NextResponse.json({
      success: true,
      teams,
      tournament_id: tournamentId,
      season_id: seasonId
    });
  } catch (error) {
    console.error('Error fetching tournament teams:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// POST - Assign teams to tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { team_ids } = body;

    if (!team_ids || !Array.isArray(team_ids)) {
      return NextResponse.json(
        { success: false, error: 'team_ids array is required' },
        { status: 400 }
      );
    }

    // Get tournament details
    const tournament = await sql`
      SELECT season_id FROM tournaments WHERE id = ${tournamentId} LIMIT 1
    `;

    if (tournament.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const seasonId = tournament[0].season_id;

    // First, remove all existing team assignments for this tournament
    await sql`
      UPDATE teamstats
      SET tournament_id = NULL
      WHERE tournament_id = ${tournamentId}
        AND season_id = ${seasonId}
    `;

    // Then assign the selected teams to this tournament
    if (team_ids.length > 0) {
      for (const teamId of team_ids) {
        await sql`
          UPDATE teamstats
          SET tournament_id = ${tournamentId}
          WHERE team_id = ${teamId}
            AND season_id = ${seasonId}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${team_ids.length} team(s) assigned to tournament`,
      assigned_count: team_ids.length
    });
  } catch (error) {
    console.error('Error assigning teams to tournament:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign teams' },
      { status: 500 }
    );
  }
}

// DELETE - Remove all team assignments from tournament
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Remove all team assignments for this tournament
    const result = await sql`
      UPDATE teamstats
      SET tournament_id = NULL
      WHERE tournament_id = ${tournamentId}
      RETURNING team_id
    `;

    return NextResponse.json({
      success: true,
      message: 'All team assignments removed',
      removed_count: result.length
    });
  } catch (error) {
    console.error('Error removing team assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove team assignments' },
      { status: 500 }
    );
  }
}
