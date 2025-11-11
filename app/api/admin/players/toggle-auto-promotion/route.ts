import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/admin/players/toggle-auto-promotion
 * Toggle the prevent_auto_promotion flag for a player
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_id, season_id, prevent } = body;

    if (!player_id || !season_id || typeof prevent !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: player_id, season_id, and prevent' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Update the prevent_auto_promotion flag
    await sql`
      UPDATE player_seasons
      SET 
        prevent_auto_promotion = ${prevent},
        updated_at = NOW()
      WHERE player_id = ${player_id}
        AND season_id = ${season_id}
    `;

    // Get player name for response message
    const playerData = await sql`
      SELECT player_name
      FROM player_seasons
      WHERE player_id = ${player_id}
        AND season_id = ${season_id}
      LIMIT 1
    `;

    const playerName = playerData[0]?.player_name || player_id;

    return NextResponse.json({
      success: true,
      message: prevent 
        ? `${playerName} will NOT be auto-promoted`
        : `${playerName} can now be auto-promoted`,
      data: {
        player_id,
        season_id,
        prevent_auto_promotion: prevent,
      },
    });
  } catch (error: any) {
    console.error('Error toggling auto-promotion:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to toggle auto-promotion setting',
      },
      { status: 500 }
    );
  }
}
