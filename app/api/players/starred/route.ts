import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { cookies } from 'next/headers';
import { getFirebaseUidFromToken } from '@/lib/jwt-decode';

export async function GET(request: NextRequest) {
  try {
    // Get token cookie and verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Decode token locally (no Firebase verification for starred players)
    const firebaseUid = getFirebaseUidFromToken(token);
    
    if (!firebaseUid) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get the Neon team_id for this user
    const teamResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${firebaseUid} LIMIT 1
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found in database' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;

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
