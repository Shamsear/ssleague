import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Get all seasons
    const seasonsSnapshot = await adminDb.collection('seasons').get();
    const seasons = seasonsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get active season
    const activeSeasonSnapshot = await adminDb
      .collection('seasons')
      .where('isActive', '==', true)
      .get();

    const activeSeason = activeSeasonSnapshot.empty 
      ? null 
      : { id: activeSeasonSnapshot.docs[0].id, ...activeSeasonSnapshot.docs[0].data() };

    // Count team_seasons for each season
    const teamSeasonsCounts: { [key: string]: number } = {};
    for (const season of seasons) {
      const teamSeasonsSnapshot = await adminDb
        .collection('team_seasons')
        .where('season_id', '==', season.id)
        .get();
      teamSeasonsCounts[season.id] = teamSeasonsSnapshot.size;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSeasons: seasons.length,
        seasons: seasons,
        activeSeason: activeSeason,
        teamSeasonsCounts: teamSeasonsCounts,
      },
    });

  } catch (error: any) {
    console.error('Error in diagnostic:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Diagnostic failed',
    }, { status: 500 });
  }
}
