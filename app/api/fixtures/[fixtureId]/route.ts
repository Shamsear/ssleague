import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Fetch a single fixture by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;

    if (!fixtureId) {
      return NextResponse.json(
        { error: 'fixtureId is required' },
        { status: 400 }
      );
    }

    // Fetch the fixture from Neon
    const fixtures = await sql`
      SELECT * FROM fixtures
      WHERE id = ${fixtureId}
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ fixture: fixtures[0] });
  } catch (error) {
    console.error('Error fetching fixture:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixture' },
      { status: 500 }
    );
  }
}

// PATCH - Update fixture MOTM and penalty goals
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { fixtureId } = await params;
    const body = await request.json();
    const { motm_player_id, motm_player_name, home_penalty_goals, away_penalty_goals } = body;

    // Update MOTM and penalty goals for fixture
    await sql`
      UPDATE fixtures
      SET 
        motm_player_id = ${motm_player_id || null},
        motm_player_name = ${motm_player_name || null},
        home_penalty_goals = ${home_penalty_goals || 0},
        away_penalty_goals = ${away_penalty_goals || 0},
        updated_at = NOW()
      WHERE id = ${fixtureId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Match details updated successfully' 
    });
  } catch (error) {
    console.error('Error updating MOTM:', error);
    return NextResponse.json(
      { error: 'Failed to update match details' },
      { status: 500 }
    );
  }
}
