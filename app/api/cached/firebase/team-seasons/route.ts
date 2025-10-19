import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/cached/firebase/team-seasons
 * Returns team_seasons data with ISR caching
 * 
 * Query params:
 * - seasonId: Filter by season (optional)
 * - teamId: Filter by team (optional)
 * 
 * Cache: 60 seconds (teams update during matches)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const teamId = searchParams.get('teamId');
    
    let query = adminDb.collection('team_seasons');
    
    if (seasonId) {
      query = query.where('season_id', '==', seasonId) as any;
    }
    
    if (teamId) {
      query = query.where('team_id', '==', teamId) as any;
    }
    
    const snapshot = await query.get();
    
    const teamSeasons = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return NextResponse.json(
      {
        success: true,
        data: teamSeasons,
        cached: true,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'CDN-Cache-Control': 'public, s-maxage=60',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching team_seasons:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team seasons',
      },
      { status: 500 }
    );
  }
}

export const revalidate = 60; // Revalidate every 60 seconds
export const dynamic = 'force-static';
