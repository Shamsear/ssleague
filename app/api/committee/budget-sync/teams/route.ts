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

    // Get all teams from Neon
    const neonTeams = await sql`
      SELECT 
        id,
        name,
        football_budget,
        football_spent
      FROM teams
      WHERE season_id = ${seasonId}
      ORDER BY name
    `;

    // Create map of Neon teams
    const neonTeamsMap = new Map();
    for (const team of neonTeams) {
      neonTeamsMap.set(team.id, team);
    }

    // Build team data
    const teams = [];

    for (const tsDoc of teamSeasonsSnapshot.docs) {
      const tsData = tsDoc.data();
      const teamId = tsData.team_id;
      const teamName = tsData.team_name || 'Unknown';
      
      const neonTeam = neonTeamsMap.get(teamId);

      if (!neonTeam) {
        continue; // Skip teams not in Neon
      }

      const currencySystem = tsData.currency_system || 'single';

      teams.push({
        teamId,
        teamName,
        currencySystem,
        firebase: {
          football_budget: tsData.football_budget || 0,
          football_spent: tsData.football_spent || 0,
          real_player_budget: tsData.real_player_budget || 0,
          real_player_spent: tsData.real_player_spent || 0
        },
        neon: {
          football_budget: parseFloat(neonTeam.football_budget) || 0,
          football_spent: parseFloat(neonTeam.football_spent) || 0
        }
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
