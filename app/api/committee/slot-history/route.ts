import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/committee/slot-history
 * Get slot purchase history for all teams in a season
 * Committee admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Verify committee admin auth
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Get all slot purchase history for this season
    const history = await sql`
      SELECT 
        id,
        team_id,
        slots_purchased,
        price_per_slot,
        total_cost,
        purchased_by,
        notes,
        purchased_at
      FROM football_slot_purchases
      WHERE season_id = ${season_id}
      ORDER BY team_id, purchased_at DESC
    `;

    return NextResponse.json({
      success: true,
      history: history.map(h => ({
        id: h.id,
        team_id: h.team_id,
        slots_purchased: parseInt(h.slots_purchased) || 0,
        price_per_slot: parseFloat(h.price_per_slot) || 0,
        total_cost: parseFloat(h.total_cost) || 0,
        purchased_by: h.purchased_by || 'unknown',
        notes: h.notes || '',
        purchased_at: h.purchased_at
      }))
    });

  } catch (error) {
    console.error('Error fetching slot history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch slot history' },
      { status: 500 }
    );
  }
}
