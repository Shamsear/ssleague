import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withCache } from '@/lib/cache/memory-cache';

// Cache for 60 seconds
export const revalidate = 60;

/**
 * GET /api/public/current-season
 * Returns the active season (not completed) with basic info
 */
export async function GET() {
  try {
    // Use cache with 60 second TTL to dramatically reduce Firebase reads
    const result = await withCache(
      'public:current-season',
      async () => {
        console.log('🔍 Fetching active season from Firebase...');
        
        // Get the first active season (status != 'completed')
        const seasonsSnapshot = await adminDb
          .collection('seasons')
          .where('status', '!=', 'completed')
          .orderBy('status')
          .orderBy('created_at', 'desc')
          .limit(1)
          .get();
        
        if (seasonsSnapshot.empty) {
          // No active season, get the most recent completed season
          console.log('⚠️ No active season, fetching most recent...');
          const recentSeasonSnapshot = await adminDb
            .collection('seasons')
            .where('is_historical', '==', false)
            .orderBy('created_at', 'desc')
            .limit(1)
            .get();
          
          if (recentSeasonSnapshot.empty) {
            return {
              success: false,
              message: 'No seasons found'
            };
          }
          
          const seasonDoc = recentSeasonSnapshot.docs[0];
          const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as any;
          
          // Generate name from ID if missing
          if (!seasonData.name && seasonDoc.id) {
            const seasonNum = seasonDoc.id.match(/\d+/);
            if (seasonNum) {
              seasonData.name = `Season ${seasonNum[0]}`;
            } else {
              seasonData.name = seasonDoc.id;
            }
          }
          
          return {
            success: true,
            data: seasonData,
            isActive: false
          };
        }
        
        const seasonDoc = seasonsSnapshot.docs[0];
        const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as any;
        
        // Generate name from ID if missing
        if (!seasonData.name && seasonDoc.id) {
          const seasonNum = seasonDoc.id.match(/\d+/);
          if (seasonNum) {
            seasonData.name = `Season ${seasonNum[0]}`;
          } else {
            seasonData.name = seasonDoc.id;
          }
        }
        
        console.log(`✅ Found active season: ${seasonData.name} (${seasonDoc.id})`);
        
        return {
          success: true,
          data: seasonData,
          isActive: true
        };
      },
      60 // Cache for 60 seconds
    );
    
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('❌ Error fetching current season:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch current season',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
