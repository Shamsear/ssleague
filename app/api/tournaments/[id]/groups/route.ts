import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Get current group assignments for a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Get tournament details
    const tournament = await sql`
      SELECT id, tournament_name, group_assignment_mode, number_of_groups
      FROM tournaments
      WHERE id = ${tournamentId}
      LIMIT 1
    `;

    if (tournament.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get assigned teams
    const assignments = await sql`
      SELECT ttg.team_id, ttg.group_name, ts.team_name
      FROM tournament_team_groups ttg
      JOIN teamstats ts ON ttg.team_id = ts.team_id AND ts.tournament_id = ${tournamentId}
      WHERE ttg.tournament_id = ${tournamentId}
      ORDER BY ttg.group_name, ts.team_name
    `;

    // Get all teams in tournament (not yet assigned)
    const allTeams = await sql`
      SELECT team_id, team_name
      FROM teamstats
      WHERE tournament_id = ${tournamentId}
      ORDER BY team_name
    `;

    const assignedTeamIds = new Set(assignments.map(a => a.team_id));
    const unassignedTeams = allTeams.filter(t => !assignedTeamIds.has(t.team_id));

    return NextResponse.json({
      success: true,
      tournament: tournament[0],
      assignments,
      unassignedTeams,
    });
  } catch (error) {
    console.error('Error fetching group assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch group assignments' },
      { status: 500 }
    );
  }
}

// POST - Save group assignments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { assignments } = body; // Array of { team_id, group_name }

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { success: false, error: 'assignments array is required' },
        { status: 400 }
      );
    }

    // Delete existing assignments for this tournament
    await sql`
      DELETE FROM tournament_team_groups
      WHERE tournament_id = ${tournamentId}
    `;

    // Insert new assignments
    if (assignments.length > 0) {
      for (const assignment of assignments) {
        await sql`
          INSERT INTO tournament_team_groups (tournament_id, team_id, group_name, created_at, updated_at)
          VALUES (${tournamentId}, ${assignment.team_id}, ${assignment.group_name}, NOW(), NOW())
        `;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${assignments.length} teams assigned to groups`,
    });
  } catch (error) {
    console.error('Error saving group assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save group assignments' },
      { status: 500 }
    );
  }
}

// DELETE - Clear all group assignments for tournament
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    await sql`
      DELETE FROM tournament_team_groups
      WHERE tournament_id = ${tournamentId}
    `;

    return NextResponse.json({
      success: true,
      message: 'All group assignments cleared',
    });
  } catch (error) {
    console.error('Error clearing group assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear group assignments' },
      { status: 500 }
    );
  }
}
