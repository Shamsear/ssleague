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

    // Parse request body
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ success: false, error: 'Invalid updates format' }, { status: 400 });
    }

    let updated = 0;
    const errors = [];

    for (const update of updates) {
      const { teamId, changes } = update;

      try {
        // Update Firebase team_seasons
        const teamSeasonSnapshot = await adminDb.collection('team_seasons')
          .where('team_id', '==', teamId)
          .where('season_id', '==', seasonId)
          .limit(1)
          .get();

        if (!teamSeasonSnapshot.empty) {
          const teamSeasonDoc = teamSeasonSnapshot.docs[0];
          const firebaseUpdates: any = {};

          // Firebase fields
          if ('football_budget' in changes) firebaseUpdates.football_budget = changes.football_budget;
          if ('football_spent' in changes) firebaseUpdates.football_spent = changes.football_spent;
          if ('real_player_budget' in changes) firebaseUpdates.real_player_budget = changes.real_player_budget;
          if ('real_player_spent' in changes) firebaseUpdates.real_player_spent = changes.real_player_spent;

          if (Object.keys(firebaseUpdates).length > 0) {
            await teamSeasonDoc.ref.update(firebaseUpdates);
            console.log(`✅ Updated Firebase for team ${teamId}:`, firebaseUpdates);
          }
        }

        // Update Neon teams
        const neonUpdates: any = {};
        if ('neon_football_budget' in changes) neonUpdates.football_budget = changes.neon_football_budget;
        if ('neon_football_spent' in changes) neonUpdates.football_spent = changes.neon_football_spent;

        if (Object.keys(neonUpdates).length > 0) {
          await sql`
            UPDATE teams
            SET 
              football_budget = ${neonUpdates.football_budget !== undefined ? neonUpdates.football_budget : sql`football_budget`},
              football_spent = ${neonUpdates.football_spent !== undefined ? neonUpdates.football_spent : sql`football_spent`},
              updated_at = NOW()
            WHERE id = ${teamId}
            AND season_id = ${seasonId}
          `;
          
          console.log(`✅ Updated Neon for team ${teamId}:`, neonUpdates);
        }

        updated++;
      } catch (error: any) {
        console.error(`❌ Error updating team ${teamId}:`, error);
        errors.push({ teamId, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Error updating budgets:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update budgets' },
      { status: 500 }
    );
  }
}
