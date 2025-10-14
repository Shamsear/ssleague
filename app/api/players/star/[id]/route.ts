import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: playerId } = await params;

    // Insert into starred_players table (ON CONFLICT DO NOTHING prevents duplicates)
    await sql`
      INSERT INTO starred_players (team_id, player_id)
      VALUES (${teamId}, ${playerId})
      ON CONFLICT (team_id, player_id) DO NOTHING
    `;

    return NextResponse.json({
      success: true,
      message: 'Player starred successfully'
    });
  } catch (error: any) {
    console.error('Error starring player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to star player'
      },
      { status: 500 }
    );
  }
}
