import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/teams/registered
 * Fetch all registered teams from the current season in Firestore
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching registered teams from Firestore...');
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    console.log('Season ID param:', seasonId);

    // Get target season ID
    let targetSeasonId = seasonId;
    
    if (!targetSeasonId) {
      // Get all teams to find the latest season
      const allTeamsSnapshot = await adminDb.collection('team_seasons').get();
      
      if (!allTeamsSnapshot.empty) {
        // Get all unique season IDs and sort to find the latest
        const seasons = Array.from(new Set(
          allTeamsSnapshot.docs.map(doc => doc.data().season_id)
        )).sort().reverse();
        
        targetSeasonId = seasons[0]; // Most recent season (e.g., SSPSLS17)
        console.log('📅 Available seasons:', seasons);
        console.log(`✅ Using latest season: ${targetSeasonId}`);
      }
    }
    
    if (!targetSeasonId) {
      console.log('⚠️ No seasons found');
      return NextResponse.json({
        success: true,
        teams: [],
        count: 0,
      });
    }
    
    // Fetch teams for the target season only
    console.log(`👥 Fetching teams for season: ${targetSeasonId}`);
    const teamsSnapshot = await adminDb.collection('team_seasons')
      .where('season_id', '==', targetSeasonId)
      .get();
    
    const teams = teamsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        team_id: doc.id,
        team_name: data.team_name || 'Unknown Team',
        team_code: data.team_code || '',
        owner_name: data.owner_name || data.username || '',
        team_logo: data.team_logo || null,
      };
    });
    
    // Sort by team name
    teams.sort((a, b) => a.team_name.localeCompare(b.team_name));
    console.log(`✅ Found ${teams.length} teams:`, teams.map(t => t.team_name));

    return NextResponse.json({
      success: true,
      teams: teams.map((team: any) => ({
        team_id: team.team_id,
        team_name: team.team_name,
        team_code: team.team_code,
        owner_name: team.owner_name,
        team_logo: team.team_logo,
      })),
      count: teams.length,
    });
  } catch (error) {
    console.error('Error fetching registered teams:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch teams',
        details: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
