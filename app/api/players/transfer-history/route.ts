import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/players/transfer-history
 * Get transaction history for transfers, swaps, and releases
 * 
 * This endpoint returns a paginated list of player transactions with filtering options.
 * Includes all transaction details including committee fees, star rating changes, and
 * financial information.
 * 
 * Query Parameters:
 * - season_id: string (required)
 * - team_id: string (optional) - Filter by team involvement
 * - transaction_type: string (optional) - Filter by type: 'transfer', 'swap', 'release'
 * - limit: number (optional, default: 50) - Number of results per page
 * - offset: number (optional, default: 0) - Pagination offset
 * - order_by: string (optional, default: 'created_at') - Field to order by
 * - order_direction: string (optional, default: 'desc') - 'asc' or 'desc'
 * 
 * Examples:
 * - All transactions: /api/players/transfer-history?season_id=SSPSLS16
 * - Team specific: /api/players/transfer-history?season_id=SSPSLS16&team_id=SSPSLT0001
 * - Transfers only: /api/players/transfer-history?season_id=SSPSLS16&transaction_type=transfer
 * - Paginated: /api/players/transfer-history?season_id=SSPSLS16&limit=20&offset=20
 * 
 * Requirements: 9.1, 9.2
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id');
    const team_id = searchParams.get('team_id');
    const transaction_type = searchParams.get('transaction_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const order_by = searchParams.get('order_by') || 'created_at';
    const order_direction = searchParams.get('order_direction') || 'desc';

    // Validate required fields
    if (!season_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: season_id',
          errorCode: 'MISSING_SEASON_ID'
        },
        { status: 400 }
      );
    }

    // Validate limit and offset
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Limit must be between 1 and 100',
          errorCode: 'INVALID_LIMIT'
        },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Offset must be non-negative',
          errorCode: 'INVALID_OFFSET'
        },
        { status: 400 }
      );
    }

    // Validate transaction type
    if (transaction_type && !['transfer', 'swap', 'release'].includes(transaction_type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid transaction_type. Must be "transfer", "swap", or "release"',
          errorCode: 'INVALID_TRANSACTION_TYPE'
        },
        { status: 400 }
      );
    }

    // Validate order direction
    if (!['asc', 'desc'].includes(order_direction)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid order_direction. Must be "asc" or "desc"',
          errorCode: 'INVALID_ORDER_DIRECTION'
        },
        { status: 400 }
      );
    }

    // Build query
    let query = adminDb.collection('player_transactions')
      .where('season_id', '==', season_id);

    // Apply filters
    if (transaction_type) {
      query = query.where('transaction_type', '==', transaction_type);
    }

    // Order by
    query = query.orderBy(order_by, order_direction as 'asc' | 'desc');

    // Execute query
    const snapshot = await query.get();

    // Filter by team if specified (done in memory since we need OR logic)
    let transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || null
    }));

    // Filter by team involvement if team_id is specified
    if (team_id) {
      transactions = transactions.filter(tx => {
        if (tx.transaction_type === 'transfer' || tx.transaction_type === 'release') {
          return tx.old_team_id === team_id || tx.new_team_id === team_id;
        } else if (tx.transaction_type === 'swap') {
          return tx.team_a_id === team_id || tx.team_b_id === team_id;
        }
        return false;
      });
    }

    // Get total count before pagination
    const total = transactions.length;

    // Apply pagination
    const paginatedTransactions = transactions.slice(offset, offset + limit);

    // Format response
    const formattedTransactions = paginatedTransactions.map(tx => {
      const base = {
        id: tx.id,
        transaction_type: tx.transaction_type,
        season_id: tx.season_id,
        processed_by: tx.processed_by,
        processed_by_name: tx.processed_by_name,
        created_at: tx.created_at
      };

      if (tx.transaction_type === 'transfer') {
        return {
          ...base,
          player: {
            id: tx.player_id,
            name: tx.player_name,
            type: tx.player_type
          },
          old_team_id: tx.old_team_id,
          new_team_id: tx.new_team_id,
          values: {
            old_value: tx.old_value,
            new_value: tx.new_value
          },
          star_rating: {
            old: tx.old_star_rating,
            new: tx.new_star_rating,
            points_added: tx.points_added
          },
          financial: {
            committee_fee: tx.committee_fee,
            buying_team_paid: tx.buying_team_paid,
            selling_team_received: tx.selling_team_received
          },
          new_salary: tx.new_salary
        };
      } else if (tx.transaction_type === 'swap') {
        return {
          ...base,
          player_a: {
            id: tx.player_a_id,
            name: tx.player_a_name,
            type: tx.player_a_type,
            old_value: tx.player_a_old_value,
            new_value: tx.player_a_new_value,
            old_star: tx.player_a_old_star,
            new_star: tx.player_a_new_star,
            points_added: tx.player_a_points_added,
            new_salary: tx.player_a_new_salary
          },
          player_b: {
            id: tx.player_b_id,
            name: tx.player_b_name,
            type: tx.player_b_type,
            old_value: tx.player_b_old_value,
            new_value: tx.player_b_new_value,
            old_star: tx.player_b_old_star,
            new_star: tx.player_b_new_star,
            points_added: tx.player_b_points_added,
            new_salary: tx.player_b_new_salary
          },
          teams: {
            team_a_id: tx.team_a_id,
            team_b_id: tx.team_b_id,
            team_a_pays: tx.team_a_pays,
            team_b_pays: tx.team_b_pays
          },
          financial: {
            team_a_fee: tx.team_a_fee,
            team_b_fee: tx.team_b_fee,
            total_committee_fees: tx.total_committee_fees,
            cash_amount: tx.cash_amount,
            cash_direction: tx.cash_direction
          }
        };
      } else if (tx.transaction_type === 'release') {
        return {
          ...base,
          player: {
            id: tx.player_id,
            name: tx.player_name,
            type: tx.player_type
          },
          old_team_id: tx.old_team_id,
          financial: {
            refund_amount: tx.refund_amount
          }
        };
      }

      return base;
    });

    return NextResponse.json({
      success: true,
      season_id,
      filters: {
        team_id: team_id || null,
        transaction_type: transaction_type || null
      },
      pagination: {
        limit,
        offset,
        total,
        has_more: offset + limit < total
      },
      transactions: formattedTransactions
    });

  } catch (error: any) {
    console.error('Error in transfer-history API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to get transfer history',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
