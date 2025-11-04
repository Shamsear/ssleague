import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/committee/salary-transactions
 * 
 * Fetches real player salary transactions by team
 * Query params:
 *   - teamId: Filter by specific team (optional, if not provided returns all teams)
 *   - seasonId: Filter by season (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const seasonId = searchParams.get('seasonId');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'seasonId is required' },
        { status: 400 }
      );
    }

    // Build query for transactions - simplified to avoid composite index
    // Query by season_id and team_id only, then filter in memory
    let transactionsQuery = adminDb
      .collection('transactions')
      .where('season_id', '==', seasonId);

    // Filter by team if specified
    if (teamId) {
      transactionsQuery = transactionsQuery.where('team_id', '==', teamId);
    }

    transactionsQuery = transactionsQuery.limit(5000);

    const transactionsSnapshot = await transactionsQuery.get();
    console.log(`📊 Total transactions fetched: ${transactionsSnapshot.docs.length}`);
    
    // Filter in memory for currency_type and transaction_type
    const filteredDocs = transactionsSnapshot.docs.filter(doc => {
      const data = doc.data();
      const match = data.currency_type === 'real_player' && 
                    (data.transaction_type === 'salary' || data.transaction_type === 'salary_payment');
      if (!match) {
        console.log(`  ⏭️  Skipping: ${data.transaction_type} / ${data.currency_type}`);
      }
      return match;
    });
    console.log(`✅ Filtered to ${filteredDocs.length} salary transactions`);
    console.log(`📋 Query params: seasonId=${seasonId}, teamId=${teamId || 'ALL'}`);
    
    // Log first few transactions for debugging
    if (filteredDocs.length > 0) {
      console.log(`First transaction:`, filteredDocs[0].data());
    }
    
    // Sort by created_at in memory
    const sortedDocs = filteredDocs.sort((a, b) => {
      const aTime = a.data().created_at?.toMillis?.() || 0;
      const bTime = b.data().created_at?.toMillis?.() || 0;
      return bTime - aTime;
    }).slice(0, 1000);

    // Fetch all teams for name lookup
    const teamsSnapshot = await adminDb.collection('teams').get();
    const teamsMap = new Map();
    teamsSnapshot.forEach(doc => {
      teamsMap.set(doc.id, doc.data().teamName || doc.data().name || 'Unknown Team');
    });

    // Fetch all real players for name lookup
    const realPlayersSnapshot = await adminDb.collection('realplayers').get();
    const realPlayersMap = new Map();
    realPlayersSnapshot.forEach(doc => {
      const data = doc.data();
      realPlayersMap.set(doc.id, {
        name: data.name,
        salary_per_match: data.salary_per_match || 0,
        star_rating: data.star_rating || 3,
      });
    });

    // Process transactions
    const transactions: any[] = [];

    sortedDocs.forEach(doc => {
      const data = doc.data();
      const metadata = data.metadata || {};

      transactions.push({
        id: doc.id,
        team_id: data.team_id,
        team_name: teamsMap.get(data.team_id) || 'Unknown Team',
        date: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        transaction_type: data.transaction_type,
        amount: data.amount || 0,
        reason: data.reason || data.description || 'Salary payment',
        balance_after: data.balance_after || 0,
        // Extract player info from metadata
        player_id: metadata.player_id,
        player_name: metadata.player_name || realPlayersMap.get(metadata.player_id)?.name || 'Unknown Player',
        salary_per_match: metadata.salary_per_match || Math.abs(data.amount || 0),
        points_change: metadata.points_change || 0,
        star_rating: metadata.star_rating || realPlayersMap.get(metadata.player_id)?.star_rating || 3,
        // Match/round info
        round_number: metadata.round_number,
        fixture_id: metadata.fixture_id,
        match_date: metadata.match_date,
        opponent_team_id: metadata.opponent_team_id,
        result: metadata.result,
      });
    });

    // Group by team and match if needed
    if (teamId) {
      // Group by fixture/match for single team view
      const groupedByMatch = transactions.reduce((acc, txn) => {
        const key = txn.fixture_id || txn.round_number || 'unknown';
        if (!acc[key]) {
          acc[key] = {
            fixture_id: txn.fixture_id,
            round_number: txn.round_number,
            match_date: txn.match_date,
            team_id: txn.team_id,
            team_name: txn.team_name,
            opponent_team_id: txn.opponent_team_id,
            result: txn.result,
            players: [],
            total_salary: 0,
          };
        }
        
        acc[key].players.push({
          player_id: txn.player_id,
          player_name: txn.player_name,
          salary_per_match: txn.salary_per_match,
          points_change: txn.points_change,
          star_rating: txn.star_rating,
          amount: txn.amount,
        });
        
        acc[key].total_salary += Math.abs(txn.amount);
        
        return acc;
      }, {} as Record<string, any>);

      const result = Object.values(groupedByMatch).sort((a: any, b: any) => {
        return new Date(b.match_date || 0).getTime() - new Date(a.match_date || 0).getTime();
      });

      return NextResponse.json({
        success: true,
        data: result,
        count: result.length,
      });
    } else {
      // Return flat list for all teams
      return NextResponse.json({
        success: true,
        data: transactions,
        count: transactions.length,
      });
    }

  } catch (error: any) {
    console.error('Error fetching salary transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch salary transactions' },
      { status: 500 }
    );
  }
}
