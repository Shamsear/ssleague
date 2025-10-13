import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const seasonsRef = adminDb.collection('seasons');
    
    // Order by creation date (newest first)
    const snapshot = await seasonsRef.orderBy('created_at', 'desc').get();
    
    // OPTIMIZED: Get all team_seasons in one query instead of per season
    const allTeamSeasonsSnapshot = await adminDb.collection('team_seasons').get();
    
    // Build a map of season_id -> team count
    const teamCountsBySeasonId = new Map<string, number>();
    allTeamSeasonsSnapshot.docs.forEach(doc => {
      const seasonId = doc.data().season_id;
      if (seasonId) {
        teamCountsBySeasonId.set(
          seasonId, 
          (teamCountsBySeasonId.get(seasonId) || 0) + 1
        );
      }
    });
    
    const seasons = snapshot.docs.map(doc => {
      const data = doc.data();
      const teamsCount = teamCountsBySeasonId.get(doc.id) || 0;
      
      // Count awards if they exist (placeholder for future implementation)
      const awardsCount = 0; // TODO: Implement when awards system is added
      
      return {
        id: doc.id,
        name: data.name || 'Unknown Season',
        short_name: data.short_name || data.name?.substring(0, 10) || 'Season',
        description: data.description || '',
        status: data.status || 'completed',
        is_active: data.is_active || false,
        created_at: data.created_at?.toDate() || new Date(),
        updated_at: data.updated_at?.toDate() || new Date(),
        teams_count: teamsCount,
        awards_count: awardsCount,
        starting_balance: data.starting_balance || 0,
        max_teams: data.max_teams || 0,
        registration_deadline: data.registration_deadline?.toDate() || null,
        season_start: data.season_start?.toDate() || null,
        season_end: data.season_end?.toDate() || null,
      };
    });
    
    return NextResponse.json({
      success: true,
      data: seasons
    });
  } catch (error: any) {
    console.error('Error fetching historical seasons:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}