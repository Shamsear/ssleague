import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// Enable caching for seasons list (2 minutes)
export const revalidate = 120;
export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  try {
    // Get all seasons
    const seasonsSnapshot = await adminDb.collection('seasons').orderBy('created_at', 'desc').get();
    
    // OPTIMIZED: Get all teams once and count per season
    const allTeamsSnapshot = await adminDb.collection('teams').get();
    
    // Build map of season_id -> team count
    const teamCountsBySeasonId = new Map<string, number>();
    allTeamsSnapshot.docs.forEach(teamDoc => {
      const teamData = teamDoc.data();
      const seasons = teamData.seasons || [];
      
      seasons.forEach((seasonId: string) => {
        teamCountsBySeasonId.set(
          seasonId,
          (teamCountsBySeasonId.get(seasonId) || 0) + 1
        );
      });
    });
    
    const seasons = seasonsSnapshot.docs.map((doc) => {
      const seasonData = doc.data();
      const seasonId = doc.id;
      
      // OPTIMIZED: Get team count from pre-built map
      const teams_count = teamCountsBySeasonId.get(seasonId) || 0;
      
      // Count awards for this season (if you have awards collection)
      // For now, setting to 0 - update this when you have awards functionality
      const awards_count = 0;
      
      // Convert Firestore timestamp to ISO string for JSON serialization
      const created_at = seasonData.created_at?.toDate?.() || new Date();
      
      return {
        id: seasonId,
        season_number: seasonData.season_number || null,
        status: seasonData.status || 'completed',
        is_active: seasonData.is_active || false,
        is_historical: seasonData.is_historical || false,
        created_at: created_at.toISOString(),
        teams_count,
        awards_count,
        // Additional fields that might be useful
        description: seasonData.description,
        start_date: seasonData.start_date?.toDate?.()?.toISOString(),
        end_date: seasonData.end_date?.toDate?.()?.toISOString(),
      };
    });

    return NextResponse.json(
      {
        success: true,
        seasons,
        cached: true,
        timestamp: new Date().toISOString()
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
        error: 'Failed to fetch seasons',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}