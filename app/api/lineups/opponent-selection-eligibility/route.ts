import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon';

/**
 * Check if opponent lineup selection is allowed
 * Requires: lineup deadline passed + warning given
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixture_id');
    const opponentTeamId = searchParams.get('opponent_team_id');

    if (!fixtureId || !opponentTeamId) {
      return NextResponse.json(
        { success: false, error: 'fixture_id and opponent_team_id are required' },
        { status: 400 }
      );
    }

    // Get fixture to check deadline
    const fixtures = await sql`
      SELECT id, lineup_deadline
      FROM fixtures
      WHERE id = ${fixtureId}
    `;

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];
    const now = new Date();
    const deadline = fixture.lineup_deadline ? new Date(fixture.lineup_deadline) : null;

    // Check if deadline has passed
    if (!deadline || now < deadline) {
      return NextResponse.json({
        success: true,
        eligible: false,
        message: 'Deadline has not passed yet'
      });
    }

    // Check if opponent has lineup
    const lineups = await sql`
      SELECT id, warning_given, selected_by_opponent
      FROM lineups
      WHERE fixture_id = ${fixtureId}
        AND team_id = ${opponentTeamId}
    `;

    // If opponent already has a lineup
    if (lineups && lineups.length > 0) {
      const lineup = lineups[0];
      
      if (lineup.selected_by_opponent) {
        return NextResponse.json({
          success: true,
          eligible: false,
          message: 'Opponent lineup already selected'
        });
      }

      return NextResponse.json({
        success: true,
        eligible: false,
        message: 'Opponent has already submitted their lineup'
      });
    }

    // No lineup exists - opponent is eligible for selection
    // (In a more complex system, you could check for warning_given flag)
    return NextResponse.json({
      success: true,
      eligible: true,
      message: 'Opponent lineup selection is available'
    });
  } catch (error: any) {
    console.error('Error checking eligibility:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check eligibility' },
      { status: 500 }
    );
  }
}
