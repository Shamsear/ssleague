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
        football_budget
      FROM teams
      WHERE season_id = ${seasonId}
    `;

    // Create map of Neon teams
    const neonTeamsMap = new Map();
    for (const team of neonTeams) {
      neonTeamsMap.set(team.id, team);
    }

    // Compare budgets
    const discrepancies = [];

    for (const tsDoc of teamSeasonsSnapshot.docs) {
      const tsData = tsDoc.data();
      const teamId = tsData.team_id;
      const teamName = tsData.team_name || 'Unknown';
      
      const neonTeam = neonTeamsMap.get(teamId);

      if (!neonTeam) {
        continue; // Skip teams not in Neon
      }

      // Get Firebase budget
      const currencySystem = tsData.currency_system || 'single';
      const firebaseBudget = currencySystem === 'dual' 
        ? (tsData.football_budget || 0)
        : (tsData.budget || 0);
      const neonBudget = parseInt(neonTeam.football_budget) || 0;

      // Check for discrepancies
      if (firebaseBudget !== neonBudget) {
        discrepancies.push({
          teamId,
          teamName,
          firebaseBudget,
          neonBudget,
          diff: firebaseBudget - neonBudget,
          currencySystem
        });
      }
    }

    return NextResponse.json({
      success: true,
      discrepancies,
      seasonName: seasonData.name || seasonId,
      seasonId
    });

  } catch (error: any) {
    console.error('Error checking budget sync:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check budget sync' },
      { status: 500 }
    );
  }
}
