import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    
    // Get all active players for this team in this season
    const players = await sql`
      SELECT 
        rp.player_id,
        rp.name,
        rps.category,
        rps.is_active
      FROM realplayers rp
      INNER JOIN realplayerstats rps ON rp.player_id = rps.player_id
      WHERE rps.team_id = ${teamId}
        AND rps.season_id = ${seasonId}
        AND rps.is_active = true
      ORDER BY rp.name
    `;

    return NextResponse.json({
      success: true,
      players: players
    });
  } catch (error: any) {
    console.error('Error fetching team roster:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch roster' },
      { status: 500 }
    );
  }
}
