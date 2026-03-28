import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/draft/update-tiers
 * Update tier structure after manual adjustments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, draft_type, tiers } = body;

    if (!league_id || !draft_type || !tiers || !Array.isArray(tiers)) {
      return NextResponse.json(
        { error: 'Missing required parameters: league_id, draft_type, tiers' },
        { status: 400 }
      );
    }

    // Delete existing tiers for this league and draft type
    await fantasySql`
      DELETE FROM fantasy_draft_tiers
      WHERE league_id = ${league_id} AND draft_type = ${draft_type}
    `;

    // Insert updated tiers
    for (const tier of tiers) {
      await fantasySql`
        INSERT INTO fantasy_draft_tiers (
          tier_id,
          league_id,
          draft_type,
          tier_number,
          tier_name,
          player_ids,
          player_count,
          min_points,
          max_points,
          avg_points,
          created_at
        ) VALUES (
          ${tier.tier_id},
          ${league_id},
          ${draft_type},
          ${tier.tier_number},
          ${tier.tier_name},
          ${JSON.stringify(tier.player_ids)},
          ${tier.player_count},
          ${tier.min_points},
          ${tier.max_points},
          ${tier.avg_points},
          NOW()
        )
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Tiers updated successfully',
      tiers_updated: tiers.length,
    });
  } catch (error) {
    console.error('Error updating tiers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update tiers', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
