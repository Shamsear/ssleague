import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/team-seasons
 * Fetch team_season data for a user in a specific season
 * Query params:
 * - user_id: Firebase user UID
 * - season_id: Season ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');
    const seasonId = searchParams.get('season_id');

    if (!userId || !seasonId) {
      return NextResponse.json(
        { success: false, error: 'user_id and season_id are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching team_season for:', { userId, seasonId });

    // Query team_seasons collection in Firebase
    const teamSeasonsQuery = await adminDb
      .collection('team_seasons')
      .where('user_id', '==', userId)
      .where('season_id', '==', seasonId)
      .where('status', '==', 'registered')
      .limit(1)
      .get();

    if (teamSeasonsQuery.empty) {
      console.log('❌ No team_season found for user');
      return NextResponse.json(
        { success: false, error: 'No team registration found for this season' },
        { status: 404 }
      );
    }

    const teamSeasonDoc = teamSeasonsQuery.docs[0];
    const teamSeasonData = teamSeasonDoc.data();

    console.log('✅ Found team_season:', teamSeasonData);

    return NextResponse.json({
      success: true,
      team_season: {
        id: teamSeasonDoc.id,
        ...teamSeasonData,
      },
    });
  } catch (error: any) {
    console.error('Error fetching team_season:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch team season' },
      { status: 500 }
    );
  }
}
