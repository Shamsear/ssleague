import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(['committee_admin'], request);
    
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get active season
    const seasonsSnapshot = await adminDb.collection('seasons')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (seasonsSnapshot.empty) {
      return NextResponse.json({ success: false, error: 'No active season found' }, { status: 404 });
    }

    const seasonDoc = seasonsSnapshot.docs[0];
    const seasonId = seasonDoc.id;
    const seasonData = seasonDoc.data();

    // Get all team_seasons from Firebase
    const teamSeasonsSnapshot = await adminDb.collection('team_seasons')
      .where('season_id', '==', seasonId)
      .get();

    // Build team data
    const teams = [];

    for (const tsDoc of teamSeasonsSnapshot.docs) {
      const tsData = tsDoc.data();
      
      teams.push({
        teamId: tsData.team_id,
        teamName: tsData.team_name || 'Unknown',
        currencySystem: tsData.currency_system || 'single',
        football_budget: tsData.football_budget || 0,
        real_player_budget: tsData.real_player_budget || 0
      });
    }

    // Sort by team name
    teams.sort((a, b) => a.teamName.localeCompare(b.teamName));

    return NextResponse.json({
      success: true,
      teams,
      seasonName: seasonData.name || seasonId,
      seasonId
    });

  } catch (error: any) {
    console.error('Error loading teams:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load teams' },
      { status: 500 }
    );
  }
}
