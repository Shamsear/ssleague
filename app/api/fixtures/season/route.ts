import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    let tournamentId = searchParams.get('tournament_id');

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
        tournamentId = `${seasonId}-LEAGUE`;
      }
    }

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'tournament_id or season_id is required' },
        { status: 400 }
      );
    }

    const fixtures = await sql`
      SELECT * FROM fixtures
      WHERE tournament_id = ${tournamentId}
      ORDER BY round_number ASC, match_number ASC
    `;

    return NextResponse.json({ fixtures });
  } catch (error) {
    console.error('Error fetching season fixtures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    let tournamentId = searchParams.get('tournament_id');

    // Backward compatibility
    if (seasonId && !tournamentId) {
      const primaryTournament = await sql`
        SELECT id FROM tournaments 
        WHERE season_id = ${seasonId} AND is_primary = true
        LIMIT 1
      `;
      if (primaryTournament.length > 0) {
        tournamentId = primaryTournament[0].id;
      } else {
        tournamentId = `${seasonId}-LEAGUE`;
      }
    }

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'tournament_id or season_id is required' },
        { status: 400 }
      );
    }

    // Delete matchups first (must be done before deleting fixtures)
    await sql`
      DELETE FROM matchups
      WHERE fixture_id IN (
        SELECT id FROM fixtures WHERE tournament_id = ${tournamentId}
      )
    `;

    // Then delete all fixtures for the tournament
    await sql`
      DELETE FROM fixtures
      WHERE tournament_id = ${tournamentId}
    `;

    // Delete round_deadlines for the season
    await sql`
      DELETE FROM round_deadlines
      WHERE season_id = ${seasonId}
    `;

    return NextResponse.json({ 
      success: true,
      message: 'All fixtures, matchups, and round deadlines deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting season fixtures:', error);
    return NextResponse.json(
      { error: 'Failed to delete fixtures' },
      { status: 500 }
    );
  }
}
