import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/transfers/history
 * Fetch transfer history combining player_transactions and financial transactions
 * 
 * Query params:
 * - season_id: Filter by season
 * - team_id: Filter by team
 * - type: Filter by transaction type (release, transfer, swap)
 * - player_type: Filter by player type (real, football)
 * - page: Page number (default 0)
 * - limit: Items per page (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const teamId = searchParams.get('team_id');
    const type = searchParams.get('type');
    const playerType = searchParams.get('player_type');
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Fetch player_transactions (swap tracking)
    const playerTxnsSnapshot = await adminDb.collection('player_transactions').get();
    const playerTxnsMap = new Map();
    
    playerTxnsSnapshot.forEach((doc) => {
      playerTxnsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Fetch financial transactions
    const financialTxnsSnapshot = await adminDb.collection('transactions').get();
    
    const allTxns: any[] = [];
    const seasonsSet = new Set<string>();
    const processedSwaps = new Set<string>();

    // Process financial transactions
    financialTxnsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Only include transfer-related transactions (exclude football_swap as it's handled by player_transactions)
      const transferTypes = ['release', 'transfer', 'swap', 'player_transfer', 'player_swap'];
      if (!transferTypes.includes(data.transaction_type)) {
        return;
      }

      // Collect seasons
      if (data.season_id) {
        seasonsSet.add(data.season_id);
      }

      // Apply filters
      if (data.season_id !== seasonId) return;
      if (type && data.transaction_type !== type) return;
      
      if (playerType) {
        const txPlayerType = data.player_type || data.player?.type || data.player_a?.type;
        if (txPlayerType !== playerType) return;
      }

      if (teamId) {
        const matchesTeam = 
          data.team_id === teamId ||
          data.old_team_id === teamId ||
          data.new_team_id === teamId ||
          data.teams?.team_a_id === teamId ||
          data.teams?.team_b_id === teamId ||
          data.related_team_id === teamId;
        
        if (!matchesTeam) return;
      }

      allTxns.push({
        id: doc.id,
        transaction_type: data.transaction_type,
        season_id: data.season_id,
        processed_by: data.processed_by || '',
        processed_by_name: data.processed_by_name || 'Unknown',
        created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        player_name: data.player_name,
        player_type: data.player_type,
        team_id: data.team_id,
        team_name: data.team_name,
        auction_value: data.auction_value,
        refund_amount: data.refund_amount,
        refund_percentage: data.refund_percentage,
        release_timing: data.release_timing,
        release_season: data.release_season,
        original_contract_start: data.original_contract_start,
        original_contract_end: data.original_contract_end,
        player: data.player,
        old_team_id: data.old_team_id,
        new_team_id: data.new_team_id,
        values: data.values,
        star_rating: data.star_rating,
        financial: data.financial,
        new_salary: data.new_salary,
        player_a: data.player_a,
        player_b: data.player_b,
        teams: data.teams,
      });
    });

    // Process player_transactions for swaps (combine into single entries)
    playerTxnsMap.forEach((playerTxn: any) => {
      if (playerTxn.transaction_type !== 'swap') return;
      if (processedSwaps.has(playerTxn.id)) return;

      // Collect seasons
      if (playerTxn.season_id) {
        seasonsSet.add(playerTxn.season_id);
      }

      // Apply filters
      if (playerTxn.season_id !== seasonId) return;
      if (type && type !== 'swap') return;
      if (playerType && playerTxn.player_type !== playerType) return;

      if (teamId) {
        const matchesTeam = 
          playerTxn.team_a_id === teamId ||
          playerTxn.team_b_id === teamId;
        
        if (!matchesTeam) return;
      }

      processedSwaps.add(playerTxn.id);

      allTxns.push({
        id: playerTxn.id,
        transaction_type: 'swap',
        season_id: playerTxn.season_id,
        processed_by: playerTxn.processed_by || '',
        processed_by_name: playerTxn.processed_by_name || 'System',
        created_at: playerTxn.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        player_a: {
          id: playerTxn.player_a_id,
          name: playerTxn.player_a_name,
          type: playerTxn.player_type || 'football',
          old_value: 0,
          new_value: 0,
          old_star: 0,
          new_star: 0,
          points_added: 0,
          new_salary: 0,
        },
        player_b: {
          id: playerTxn.player_b_id,
          name: playerTxn.player_b_name,
          type: playerTxn.player_type || 'football',
          old_value: 0,
          new_value: 0,
          old_star: 0,
          new_star: 0,
          points_added: 0,
          new_salary: 0,
        },
        teams: {
          team_a_id: playerTxn.team_a_id,
          team_b_id: playerTxn.team_b_id,
          team_a_pays: playerTxn.fee_team_a || 0,
          team_b_pays: playerTxn.fee_team_b || 0,
        },
        financial: {
          total_committee_fees: (playerTxn.fee_team_a || 0) + (playerTxn.fee_team_b || 0),
        },
      });
    });

    // Sort by date (newest first)
    allTxns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = allTxns.length;

    // Apply pagination
    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedTxns = allTxns.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        transactions: paginatedTxns,
        totalCount,
        hasMore: endIndex < allTxns.length,
        availableSeasons: Array.from(seasonsSet).sort().reverse(),
      },
    });

  } catch (error: any) {
    console.error('Error fetching transfer history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch transfer history' },
      { status: 500 }
    );
  }
}
