import { NextRequest, NextResponse } from 'next/server';
import { addManualTrophy } from '@/lib/award-season-trophies';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, team_name, trophy_type, trophy_name, trophy_position, notes } = body;

    if (!season_id || !team_name || !trophy_name) {
      return NextResponse.json(
        { success: false, error: 'season_id, team_name, and trophy_name are required' },
        { status: 400 }
      );
    }

    // Get team_id from teamstats
    const sql = getTournamentDb();
    const teams = await sql`
      SELECT team_id
      FROM teamstats
      WHERE season_id = ${season_id}
        AND team_name = ${team_name}
      LIMIT 1
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found in this season' },
        { status: 404 }
      );
    }

    const teamId = teams[0].team_id;

    const result = await addManualTrophy({
      team_id: teamId,
      team_name,
      season_id,
      trophy_type,
      trophy_name,
      trophy_position,
      notes
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error adding trophy:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
