import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get session cookie and verify authentication
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the session and get team_id
    const decodedClaims = await adminAuth.verifySessionCookie(session, true);
    const teamId = decodedClaims.uid;

    // Get starred players for this team
    const starredPlayers = await sql`
      SELECT 
        fp.id,
        fp.player_id,
        fp.name,
        fp.position,
        fp.position_group,
        fp.playing_style,
        fp.overall_rating,
        fp.speed,
        fp.acceleration,
        fp.ball_control,
        fp.dribbling,
        fp.low_pass,
        fp.lofted_pass,
        fp.finishing,
        fp.team_id,
        fp.team_name,
        sp.starred_at,
        true as is_starred
      FROM starred_players sp
      INNER JOIN footballplayers fp ON sp.player_id = fp.id
      WHERE sp.team_id = ${teamId}
      ORDER BY sp.starred_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: {
        players: starredPlayers,
        count: starredPlayers.length
      },
      message: 'Starred players fetched successfully'
    });
  } catch (error: any) {
    console.error('Error fetching starred players:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch starred players'
      },
      { status: 500 }
    );
  }
}
