import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/cached/firebase/match-data
 * Returns match_days and round_deadlines data with ISR caching
 * 
 * Query params:
 * - seasonId: Filter by season (required)
 * - type: 'match_days' | 'round_deadlines' | 'both' (default: 'both')
 * 
 * Cache: 120 seconds (only changes when admin activates rounds)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const type = searchParams.get('type') || 'both';
    
    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'seasonId is required' },
        { status: 400 }
      );
    }
    
    const result: any = {};
    
    // Fetch match_days if requested
    if (type === 'match_days' || type === 'both') {
      const matchDaysQuery = adminDb
        .collection('match_days')
        .where('season_id', '==', seasonId);
      
      const matchDaysSnapshot = await matchDaysQuery.get();
      result.match_days = matchDaysSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
    
    // Fetch round_deadlines if requested
    if (type === 'round_deadlines' || type === 'both') {
      // round_deadlines use composite IDs like: {seasonId}_r{roundNumber}_{leg}
      // We need to fetch all and filter by seasonId prefix
      const roundDeadlinesSnapshot = await adminDb.collection('round_deadlines').get();
      
      result.round_deadlines = roundDeadlinesSnapshot.docs
        .filter(doc => doc.id.startsWith(seasonId))
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
    }
    
    return NextResponse.json(
      {
        success: true,
        data: result,
        cached: true,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
          'CDN-Cache-Control': 'public, s-maxage=120',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=120',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching match data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch match data',
      },
      { status: 500 }
    );
  }
}

export const revalidate = 120; // Revalidate every 2 minutes
export const dynamic = 'force-static';
