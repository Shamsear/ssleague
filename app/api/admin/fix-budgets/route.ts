import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/fix-budgets
 * Fix Firebase football_spent based on team_players data
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // Get user role
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get all team spending from team_players
    const spendingResult = await sql`
      SELECT 
        team_id,
        season_id,
        SUM(purchase_price)::numeric as total_spent,
        COUNT(*) as player_count
      FROM team_players
      GROUP BY team_id, season_id
    `;

    const updates = [];

    for (const spending of spendingResult) {
      const { team_id, season_id, total_spent, player_count } = spending;
      
      try {
        const teamSeasonId = `${team_id}_${season_id}`;
        const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonDoc = await teamSeasonRef.get();
        
        if (!teamSeasonDoc.exists) {
          console.warn(`Team season ${teamSeasonId} not found`);
          continue;
        }

        const teamSeasonData = teamSeasonDoc.data();
        const currencySystem = teamSeasonData?.currency_system || 'single';
        
        // Calculate correct budget
        let originalBudget = 0;
        if (currencySystem === 'dual') {
          originalBudget = (teamSeasonData?.football_budget || 0) + (teamSeasonData?.football_spent || 0);
        } else {
          originalBudget = (teamSeasonData?.budget || 0) + (teamSeasonData?.total_spent || 0);
        }

        const correctBudget = originalBudget - Number(total_spent);

        // Update Firebase
        const updateData: any = {
          total_spent: Number(total_spent),
          players_count: Number(player_count),
          updated_at: new Date()
        };

        if (currencySystem === 'dual') {
          updateData.football_spent = Number(total_spent);
          updateData.football_budget = correctBudget;
        } else {
          updateData.budget = correctBudget;
        }

        await teamSeasonRef.update(updateData);
        
        updates.push({
          team_id,
          season_id,
          spent: Number(total_spent),
          budget: correctBudget,
          players: Number(player_count)
        });
      } catch (error) {
        console.error(`Error updating ${team_id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed budgets for ${updates.length} teams`,
      updates
    });
  } catch (error) {
    console.error('Error fixing budgets:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
