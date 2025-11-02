import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import { sql } from '@/lib/neon/config';

export async function POST(request: NextRequest) {
  try {
    // Try to get season_id from request body first (passed from client)
    const body = await request.json().catch(() => ({}));
    let seasonId: string | null = body.seasonId || null;

    // If not in body, try to get from authenticated user session
    if (!seasonId) {
      try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (session) {
          const decodedClaims = await adminAuth.verifySessionCookie(session, true);
          if (decodedClaims.role === 'committee_admin' && decodedClaims.seasonId) {
            seasonId = decodedClaims.seasonId;
          }
        }
      } catch (authError) {
        console.error('Session auth check failed:', authError);
      }
    }

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'No season_id found for committee admin' },
        { status: 400 }
      );
    }

    console.log(`🔄 Updating all players to season_id: ${seasonId}`);

    // Update all players to have this season_id
    const result = await sql`
      UPDATE footballplayers 
      SET season_id = ${seasonId}
      WHERE season_id IS NULL OR season_id = ''
    `;

    const updatedCount = result.length;

    console.log(`✅ Updated ${updatedCount} players with season_id: ${seasonId}`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} players with season_id`,
      count: updatedCount,
      seasonId
    });
  } catch (error: any) {
    console.error('❌ Error updating players season_id:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
