import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const playerId = params.id;

    // Delete from starred_players table
    await sql`
      DELETE FROM starred_players 
      WHERE team_id = ${teamId} AND player_id = ${playerId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Player unstarred successfully'
    });
  } catch (error: any) {
    console.error('Error unstarring player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to unstar player'
      },
      { status: 500 }
    );
  }
}
