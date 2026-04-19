import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
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

    // Find discrepancies and update
    let updated = 0;
    const errors = [];

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

      // Update if different
      if (firebaseBudget !== neonBudget) {
        try {
          const result = await sql`
            UPDATE teams
            SET 
              football_budget = ${firebaseBudget},
              updated_at = NOW()
            WHERE id = ${teamId}
            AND season_id = ${seasonId}
            RETURNING football_budget
          `;

          if (result.length > 0) {
            updated++;
            console.log(`✅ Synced ${teamName}: £${neonBudget} → £${firebaseBudget}`);
          } else {
            errors.push({ teamId, teamName, error: 'No rows affected' });
          }
        } catch (error: any) {
          console.error(`❌ Error syncing ${teamName}:`, error);
          errors.push({ teamId, teamName, error: error.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Error applying budget sync:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to apply budget sync' },
      { status: 500 }
    );
  }
}
