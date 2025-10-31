import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Get secondary tournaments (non-primary) for a season
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Fetch all non-primary tournaments for the season
    const tournaments = await sql`
      SELECT id, tournament_name, tournament_type, tournament_code
      FROM tournaments
      WHERE season_id = ${seasonId} AND is_primary = false
      ORDER BY display_order ASC, created_at ASC
    `;

    return NextResponse.json({ success: true, tournaments });
  } catch (error) {
    console.error('Error fetching secondary tournaments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch secondary tournaments' },
      { status: 500 }
    );
  }
}
