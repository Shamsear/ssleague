import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify Firebase ID token and get Firebase UID
    const decodedToken = await adminAuth.verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

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
