import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status'); // 'scheduled', 'completed', etc.
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = adminDb.collection('fixtures')
      .where('season_id', '==', seasonId);

    // Add team filter (home or away)
    // Note: Firestore doesn't support OR queries directly, so we need to do two queries
    const homeQuery = query.where('home_team_id', '==', teamId);
    const awayQuery = query.where('away_team_id', '==', teamId);

    // Add status filter if provided
    if (status) {
      homeQuery.where('status', '==', status);
      awayQuery.where('status', '==', status);
    }

    // Order by scheduled date
    homeQuery.orderBy('scheduled_date', 'asc').limit(limit);
    awayQuery.orderBy('scheduled_date', 'asc').limit(limit);

    // Execute both queries
    const [homeSnapshot, awaySnapshot] = await Promise.all([
      homeQuery.get(),
      awayQuery.get()
    ]);

    // Combine results
    const fixturesMap = new Map();
    
    homeSnapshot.docs.forEach(doc => {
      fixturesMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    awaySnapshot.docs.forEach(doc => {
      fixturesMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Convert to array and sort by date
    const fixtures = Array.from(fixturesMap.values())
      .sort((a: any, b: any) => {
        const dateA = a.scheduled_date?.toDate?.() || new Date(0);
        const dateB = b.scheduled_date?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      fixtures: fixtures,
      count: fixtures.length
    });
  } catch (error: any) {
    console.error('Error fetching team fixtures:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}
