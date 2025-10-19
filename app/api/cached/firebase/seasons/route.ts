import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/cached/firebase/seasons
 * Returns seasons data with ISR caching
 * 
 * Query params:
 * - isActive: Filter by active status (optional, boolean)
 * - seasonId: Get specific season (optional)
 * 
 * Cache: 120 seconds (seasons rarely change)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get('isActive');
    const seasonId = searchParams.get('seasonId');
    
    // If requesting specific season by ID
    if (seasonId) {
      const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
      
      if (!seasonDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'Season not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        {
          success: true,
          data: { id: seasonDoc.id, ...seasonDoc.data() },
          cached: true,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
            'CDN-Cache-Control': 'public, s-maxage=120',
          },
        }
      );
    }
    
    // Query all or filtered seasons
    let query = adminDb.collection('seasons');
    
    if (isActiveParam !== null) {
      const isActive = isActiveParam === 'true';
      // If requesting active seasons, get seasons that are in progress (not completed)
      // This includes draft, active, and ongoing statuses
      if (isActive) {
        // Firebase doesn't support != operator, so we fetch all and filter
        const snapshot = await query.get();
        const seasons = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((season: any) => 
            // Include seasons that are:
            // 1. Marked as active (isActive === true), OR
            // 2. Not completed (status !== 'completed')
            season.isActive === true || 
            (season.status && season.status !== 'completed')
          )
          // Sort by most recent first
          .sort((a: any, b: any) => {
            const aTime = a.created_at?._seconds || a.createdAt?._seconds || 0;
            const bTime = b.created_at?._seconds || b.createdAt?._seconds || 0;
            return bTime - aTime;
          });
        
        return NextResponse.json(
          {
            success: true,
            data: seasons,
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
      } else {
        // If requesting inactive seasons, use the original filter
        query = query.where('isActive', '==', isActive) as any;
      }
    }
    
    const snapshot = await query.get();
    
    const seasons = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return NextResponse.json(
      {
        success: true,
        data: seasons,
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
    console.error('Error fetching seasons:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch seasons',
      },
      { status: 500 }
    );
  }
}

export const revalidate = 120; // Revalidate every 2 minutes
export const dynamic = 'force-static';
