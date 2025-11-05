import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/seasons/all
 * Get all seasons (cached)
 */
export async function GET() {
  try {
    const seasonsSnapshot = await adminDb
      .collection('seasons')
      .orderBy('created_at', 'desc')
      .get();
    
    const seasons = seasonsSnapshot.docs.map(doc => {
      const data = doc.data();
      let name = data.name;
      
      // Generate name from ID if missing
      if (!name && doc.id) {
        const seasonNum = doc.id.match(/\d+/);
        if (seasonNum) {
          name = `Season ${seasonNum[0]}`;
        } else {
          name = doc.id;
        }
      }
      
      return {
        id: doc.id,
        ...data,
        name
      };
    });
    
    return NextResponse.json({
      success: true,
      seasons
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    });
  } catch (error: any) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch seasons' },
      { status: 500 }
    );
  }
}
