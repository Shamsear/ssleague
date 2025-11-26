import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/players/transfer-history
 * Fetch transfer transaction history from Firebase
 * 
 * Query Parameters:
 * - season_id: Filter by season (required)
 * - team_id: Filter by team (optional)
 * - transaction_type: Filter by type (transfer, swap, release) (optional)
 * - limit: Number of records per page (default: 20)
 * - offset: Pagination offset (default: 0)
 * - order_by: Field to order by (default: created_at)
 * - order_direction: asc or desc (default: desc)
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
    const teamId = searchParams.get('team_id');
    const transactionType = searchParams.get('transaction_type');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const orderBy = searchParams.get('order_by') || 'created_at';
    const orderDirection = searchParams.get('order_direction') || 'desc';

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    // Build Firestore query - keep it simple to avoid index requirements
    // Just filter by season_id and do the rest in memory
    console.log(`[Transfer History] Querying collection: player_transactions, season_id: ${seasonId}`);
    
    const query = adminDb
      .collection('player_transactions')
      .where('season_id', '==', seasonId);

    // Execute query
    const snapshot = await query.get();
    
    console.log(`[Transfer History] Query for season ${seasonId}: Found ${snapshot.docs.length} documents`);

    // Convert to array and transform data structure
    let transactions = snapshot.docs.map(doc => {
      const data = doc.data();
      const transformed: any = {
        id: doc.id,
        transaction_type: data.transaction_type,
        season_id: data.season_id,
        processed_by: data.processed_by,
        processed_by_name: data.processed_by_name,
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
        updated_at: data.updated_at?.toDate?.()?.toISOString() || data.updated_at,
      };

      // Transform based on transaction type
      if (data.transaction_type === 'swap') {
        transformed.player_a = {
          id: data.player_a_id,
          name: data.player_a_name,
          type: data.player_a_type,
          old_value: data.player_a_old_value,
          new_value: data.player_a_new_value,
          old_star: data.player_a_old_star,
          new_star: data.player_a_new_star,
          points_added: data.player_a_points_added,
          new_salary: data.player_a_new_salary,
        };
        transformed.player_b = {
          id: data.player_b_id,
          name: data.player_b_name,
          type: data.player_b_type,
          old_value: data.player_b_old_value,
          new_value: data.player_b_new_value,
          old_star: data.player_b_old_star,
          new_star: data.player_b_new_star,
          points_added: data.player_b_points_added,
          new_salary: data.player_b_new_salary,
        };
        transformed.teams = {
          team_a_id: data.team_a_id,
          team_b_id: data.team_b_id,
          team_a_pays: data.team_a_pays,
          team_b_pays: data.team_b_pays,
        };
        transformed.financial = {
          team_a_fee: data.team_a_fee,
          team_b_fee: data.team_b_fee,
          total_committee_fees: data.total_committee_fees,
          cash_amount: data.cash_amount,
          cash_direction: data.cash_direction,
        };
      } else if (data.transaction_type === 'transfer') {
        transformed.player = {
          id: data.player_id,
          name: data.player_name,
          type: data.player_type,
        };
        transformed.old_team_id = data.old_team_id;
        transformed.new_team_id = data.new_team_id;
        transformed.values = {
          old_value: data.old_value,
          new_value: data.new_value,
        };
        transformed.star_rating = {
          old: data.old_star,
          new: data.new_star,
          points_added: data.points_added,
        };
        transformed.financial = {
          committee_fee: data.committee_fee,
          buying_team_paid: data.buying_team_paid,
          selling_team_received: data.selling_team_received,
        };
        transformed.new_salary = data.new_salary;
      } else if (data.transaction_type === 'release') {
        transformed.player = {
          id: data.player_id,
          name: data.player_name,
          type: data.player_type,
        };
        transformed.old_team_id = data.old_team_id;
        transformed.financial = {
          refund_amount: data.refund_amount,
        };
      }

      return transformed;
    });

    // Apply in-memory filters
    if (transactionType) {
      transactions = transactions.filter(tx => tx.transaction_type === transactionType);
    }
    
    if (teamId) {
      transactions = transactions.filter(tx => {
        if (tx.transaction_type === 'transfer') {
          return tx.old_team_id === teamId || tx.new_team_id === teamId;
        } else if (tx.transaction_type === 'swap') {
          return tx.teams?.team_a_id === teamId || tx.teams?.team_b_id === teamId;
        }
        return false;
      });
    }
    
    // Sort in memory
    transactions.sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      if (orderDirection === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Get total count
    const totalCount = transactions.length;
    
    console.log(`[Transfer History] After filtering: ${totalCount} transactions`);
    console.log(`[Transfer History] Sample transaction:`, transactions[0]);

    // Apply pagination
    const paginatedTransactions = transactions.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return NextResponse.json({
      success: true,
      transactions: paginatedTransactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        has_more: hasMore,
        current_page: Math.floor(offset / limit),
        total_pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching transfer history:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
