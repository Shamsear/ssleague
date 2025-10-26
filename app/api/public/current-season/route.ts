import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// Cache for 60 seconds
export const revalidate = 60;

/**
 * GET /api/public/current-season
 * Returns the active season (not completed) with basic info
 */
export async function GET() {
  try {
    console.log('🔍 Fetching active season...');
    
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
        return NextResponse.json({
          success: false,
          message: 'No seasons found'
        }, { status: 404 });
      }
      
      const seasonDoc = recentSeasonSnapshot.docs[0];
      const seasonData = { id: seasonDoc.id, ...seasonDoc.data() };
      
      return NextResponse.json({
        success: true,
        data: seasonData,
        isActive: false
      });
    }
    
    const seasonDoc = seasonsSnapshot.docs[0];
    const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as any;
    
    console.log(`✅ Found active season: ${seasonData.name} (${seasonDoc.id})`);
    
    return NextResponse.json({
      success: true,
      data: seasonData,
      isActive: true
    });
    
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
