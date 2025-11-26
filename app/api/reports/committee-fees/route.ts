import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/reports/committee-fees
 * Generate committee fee report from Firebase transfer transactions
 * 
 * Query Parameters:
 * - season_id: Filter by season (required)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Fetch all transactions for the season
    const snapshot = await adminDb
      .collection('player_transactions')
      .where('season_id', '==', seasonId)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        report: {
          totalFees: 0,
          transferFees: 0,
          swapFees: 0,
          transactionCount: 0,
          transferCount: 0,
          swapCount: 0,
          byTeam: [],
          byMonth: []
        }
      });
    }

    // Initialize counters
    let totalFees = 0;
    let transferFees = 0;
    let swapFees = 0;
    let transferCount = 0;
    let swapCount = 0;
    
    const teamFees: Map<string, { team_name: string; total_fees: number; transaction_count: number }> = new Map();
    const monthFees: Map<string, { total_fees: number; transaction_count: number }> = new Map();

    // Process each transaction
    snapshot.docs.forEach(doc => {
      const tx = doc.data();
      const transactionType = tx.transaction_type;
      
      let feeAmount = 0;
      const teams: string[] = [];
      
      // Extract fee amount and teams based on transaction type
      if (transactionType === 'transfer') {
        feeAmount = tx.committee_fee || 0;
        transferFees += feeAmount;
        transferCount++;
        
        // For transfers, split fee equally between teams
        if (tx.old_team_id) teams.push(tx.old_team_id);
        if (tx.new_team_id) teams.push(tx.new_team_id);
        
        totalFees += feeAmount;
        
        // Track fees by team (split fee between teams)
        const feePerTeam = teams.length > 0 ? feeAmount / teams.length : 0;
        teams.forEach(teamId => {
          if (!teamFees.has(teamId)) {
            teamFees.set(teamId, {
              team_name: teamId,
              total_fees: 0,
              transaction_count: 0
            });
          }
          const teamData = teamFees.get(teamId)!;
          teamData.total_fees += feePerTeam;
          teamData.transaction_count++;
        });
        
      } else if (transactionType === 'swap') {
        feeAmount = tx.total_committee_fees || 0;
        swapFees += feeAmount;
        swapCount++;
        totalFees += feeAmount;
        
        // For swaps, use the actual amounts each team pays
        if (tx.team_a_id && tx.team_a_pays) {
          if (!teamFees.has(tx.team_a_id)) {
            teamFees.set(tx.team_a_id, {
              team_name: tx.team_a_id,
              total_fees: 0,
              transaction_count: 0
            });
          }
          const teamData = teamFees.get(tx.team_a_id)!;
          teamData.total_fees += tx.team_a_pays;
          teamData.transaction_count++;
        }
        
        if (tx.team_b_id && tx.team_b_pays) {
          if (!teamFees.has(tx.team_b_id)) {
            teamFees.set(tx.team_b_id, {
              team_name: tx.team_b_id,
              total_fees: 0,
              transaction_count: 0
            });
          }
          const teamData = teamFees.get(tx.team_b_id)!;
          teamData.total_fees += tx.team_b_pays;
          teamData.transaction_count++;
        }
      }
      
      // Track fees by month
      const createdAt = tx.created_at?.toDate ? tx.created_at.toDate() : new Date(tx.created_at);
      const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      const monthName = createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      if (!monthFees.has(monthKey)) {
        monthFees.set(monthKey, {
          total_fees: 0,
          transaction_count: 0
        });
      }
      const monthData = monthFees.get(monthKey)!;
      monthData.total_fees += feeAmount;
      monthData.transaction_count++;
    });

    // Fetch team names from Firestore
    const teamIds = Array.from(teamFees.keys());
    if (teamIds.length > 0) {
      try {
        const teamsSnapshot = await adminDb
          .collection('teams')
          .where('season_id', '==', seasonId)
          .get();
        
        const teamNames = new Map<string, string>();
        teamsSnapshot.docs.forEach(doc => {
          const teamData = doc.data();
          teamNames.set(doc.id, teamData.name || doc.id);
        });
        
        // Update team names
        teamFees.forEach((data, teamId) => {
          if (teamNames.has(teamId)) {
            data.team_name = teamNames.get(teamId)!;
          }
        });
      } catch (error) {
        console.error('Error fetching team names:', error);
        // Continue with team IDs as names
      }
    }

    // Convert maps to arrays and sort
    const byTeam = Array.from(teamFees.entries())
      .map(([team_id, data]) => ({
        team_id,
        team_name: data.team_name,
        total_fees: Math.round(data.total_fees * 100) / 100,
        transaction_count: data.transaction_count
      }))
      .sort((a, b) => b.total_fees - a.total_fees);

    const byMonth = Array.from(monthFees.entries())
      .map(([month, data]) => ({
        month,
        total_fees: Math.round(data.total_fees * 100) / 100,
        transaction_count: data.transaction_count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Round totals
    totalFees = Math.round(totalFees * 100) / 100;
    transferFees = Math.round(transferFees * 100) / 100;
    swapFees = Math.round(swapFees * 100) / 100;

    return NextResponse.json({
      success: true,
      report: {
        totalFees,
        transferFees,
        swapFees,
        transactionCount: transferCount + swapCount,
        transferCount,
        swapCount,
        byTeam,
        byMonth
      }
    });

  } catch (error) {
    console.error('Error generating committee fee report:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
