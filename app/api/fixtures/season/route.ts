import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    const fixtures = await sql`
      SELECT * FROM fixtures
      WHERE season_id = ${seasonId}
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
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Delete matchups first (must be done before deleting fixtures)
    await sql`
      DELETE FROM matchups
      WHERE fixture_id IN (
        SELECT id FROM fixtures WHERE season_id = ${seasonId}
      )
    `;

    // Then delete all fixtures for the season
    await sql`
      DELETE FROM fixtures
      WHERE season_id = ${seasonId}
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
