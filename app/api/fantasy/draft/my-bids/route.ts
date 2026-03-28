import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/draft/my-bids?team_id=xxx&league_id=xxx
 * Get existing bids for a team
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
    const teamId = searchParams.get('team_id');
    const leagueId = searchParams.get('league_id');

    if (!teamId || !leagueId) {
      return NextResponse.json(
        { error: 'team_id and league_id are required' },
        { status: 400 }
      );
    }

    // Verify team ownership
    const teams = await fantasySql`
      SELECT owner_uid
      FROM fantasy_teams
      WHERE team_id = ${teamId}
      LIMIT 1
    `;

    if (teams.length === 0 || teams[0].owner_uid !== auth.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get existing bids
    const bids = await fantasySql`
      SELECT 
        bid_id, tier_id, player_id, bid_amount, is_skip, status, submitted_at
      FROM fantasy_tier_bids
      WHERE team_id = ${teamId}
        AND league_id = ${leagueId}
      ORDER BY submitted_at DESC
    `;

    return NextResponse.json({
      success: true,
      bids
    });

  } catch (error) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch bids',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
