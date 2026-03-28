import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, tier_number, action } = body;

    if (!league_id || !tier_number || !action) {
      return NextResponse.json(
        { error: 'League ID, tier number, and action are required' },
        { status: 400 }
      );
    }

    if (!['open', 'close'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "open" or "close"' },
        { status: 400 }
      );
    }

    // Get the tier
    const [tier] = await sql`
      SELECT tier_id, tier_status
      FROM fantasy_draft_tiers
      WHERE league_id = ${league_id} AND tier_number = ${tier_number}
    `;

    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    if (action === 'open') {
      // Check if tier is pending
      if (tier.tier_status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending tiers can be opened' },
          { status: 400 }
        );
      }

      // Check if another tier is already active
      const [activeTier] = await sql`
        SELECT tier_number
        FROM fantasy_draft_tiers
        WHERE league_id = ${league_id} AND tier_status = 'active'
      `;

      if (activeTier) {
        return NextResponse.json(
          { error: `Tier ${activeTier.tier_number} is already active. Close it first.` },
          { status: 400 }
        );
      }

      // Open the tier
      await sql`
        UPDATE fantasy_draft_tiers
        SET tier_status = 'active', opened_at = NOW()
        WHERE tier_id = ${tier.tier_id}
      `;

      // Update league's current active tier
      await sql`
        UPDATE fantasy_leagues
        SET current_active_tier = ${tier_number}
        WHERE league_id = ${league_id}
      `;

      return NextResponse.json({
        success: true,
        message: `Tier ${tier_number} opened for bidding`
      });
    } else {
      // Close tier
      if (tier.tier_status !== 'active') {
        return NextResponse.json(
          { error: 'Only active tiers can be closed' },
          { status: 400 }
        );
      }

      // Close the tier
      await sql`
        UPDATE fantasy_draft_tiers
        SET tier_status = 'closed', closed_at = NOW()
        WHERE tier_id = ${tier.tier_id}
      `;

      // Clear league's current active tier
      await sql`
        UPDATE fantasy_leagues
        SET current_active_tier = NULL
        WHERE league_id = ${league_id}
      `;

      return NextResponse.json({
        success: true,
        message: `Tier ${tier_number} closed`
      });
    }
  } catch (error) {
    console.error('Error controlling tier:', error);
    return NextResponse.json(
      { error: 'Failed to control tier' },
      { status: 500 }
    );
  }
}
