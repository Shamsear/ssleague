import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { getTiersFromDatabase } from '@/lib/fantasy/tier-generator';

/**
 * GET /api/fantasy/draft/tiers?league_id=xxx&draft_type=initial
 * Get draft tiers for a league
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth([], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');
    const draftType = searchParams.get('draft_type') || 'initial';
    const tierNumber = searchParams.get('tier_number');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    if (!['initial', 'transfer'].includes(draftType)) {
      return NextResponse.json(
        { error: 'draft_type must be "initial" or "transfer"' },
        { status: 400 }
      );
    }

    const tiers = await getTiersFromDatabase(
      leagueId, 
      draftType as 'initial' | 'transfer',
      tierNumber ? parseInt(tierNumber) : undefined
    );

    return NextResponse.json({
      success: true,
      tiers
    });

  } catch (error) {
    console.error('Error fetching tiers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tiers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
