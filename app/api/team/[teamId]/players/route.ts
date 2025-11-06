import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Fetch players for a specific team and season
export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, message: 'Season ID is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Fetch players assigned to this team for the given season from player_seasons
    const players = await sql`
      SELECT 
        rp.id,
        rp.player_id,
        rp.name,
        rp.photo_url,
        rp.photo_file_id,
        rp.email,
        rp.phone,
        rp.date_of_birth,
        rp.place,
        rp.nationality,
        rp.is_active,
        rp.is_available,
        ps.jersey_number,
        ps.status as player_status
      FROM realplayers rp
      INNER JOIN player_seasons ps ON rp.player_id = ps.player_id
      WHERE ps.team_id = ${teamId} 
        AND ps.season_id = ${seasonId} 
        AND ps.status = 'active'
        AND rp.is_active = true
      ORDER BY rp.name ASC
    `;

    return NextResponse.json({
      success: true,
      data: players,
    });
  } catch (error: any) {
    console.error('Error fetching team players:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch team players' },
      { status: 500 }
    );
  }
}
