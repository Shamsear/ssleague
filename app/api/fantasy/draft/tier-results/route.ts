import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/draft/tier-results?league_id=xxx
 * Get tier-by-tier draft results showing which team won each player
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'Missing required parameter: league_id' },
        { status: 400 }
      );
    }

    // Get all tiers for this league
    const tiers = await fantasySql`
      SELECT 
        tier_id,
        tier_number,
        tier_name,
        player_count,
        min_points,
        max_points,
        avg_points,
        created_at
      FROM fantasy_draft_tiers
      WHERE league_id = ${leagueId}
        AND draft_type = 'initial'
      ORDER BY tier_number ASC
    `;

    if (tiers.length === 0) {
      return NextResponse.json({
        success: true,
        tiers: [],
        message: 'No draft tiers found for this league',
      });
    }

    // For each tier, get all bids and results
    const tierResults = await Promise.all(
      tiers.map(async (tier: any) => {
        // Get all bids for this tier
        const bids = await fantasySql`
          SELECT 
            ftb.bid_id,
            ftb.team_id,
            ftb.real_player_id,
            ftb.player_name,
            ftb.bid_amount,
            ftb.status,
            ftb.submitted_at,
            ftb.processed_at,
            ft.team_name as fantasy_team_name,
            ft.owner_name
          FROM fantasy_tier_bids ftb
          JOIN fantasy_teams ft ON ftb.team_id = ft.team_id
          WHERE ftb.tier_id = ${tier.tier_id}
          ORDER BY 
            CASE 
              WHEN ftb.status = 'won' THEN 1
              WHEN ftb.status = 'lost' THEN 2
              WHEN ftb.status = 'skipped' THEN 3
              ELSE 4
            END,
            ftb.bid_amount DESC,
            ftb.submitted_at ASC
        `;

        // Separate won, lost, and skipped bids
        const wonBids = bids.filter((b: any) => b.status === 'won');
        const lostBids = bids.filter((b: any) => b.status === 'lost');
        const skippedBids = bids.filter((b: any) => b.status === 'skipped');

        return {
          tier_id: tier.tier_id,
          tier_number: tier.tier_number,
          tier_name: tier.tier_name,
          player_count: tier.player_count,
          min_points: Number(tier.min_points),
          max_points: Number(tier.max_points),
          avg_points: Number(tier.avg_points),
          total_bids: bids.length,
          won_bids: wonBids.length,
          lost_bids: lostBids.length,
          skipped_bids: skippedBids.length,
          results: wonBids.map((bid: any) => ({
            bid_id: bid.bid_id,
            player_name: bid.player_name,
            real_player_id: bid.real_player_id,
            winning_team: bid.fantasy_team_name,
            team_id: bid.team_id,
            owner_name: bid.owner_name,
            bid_amount: Number(bid.bid_amount),
            submitted_at: bid.submitted_at,
            processed_at: bid.processed_at,
          })),
          lost_bids: lostBids.map((bid: any) => ({
            bid_id: bid.bid_id,
            player_name: bid.player_name,
            team_name: bid.fantasy_team_name,
            team_id: bid.team_id,
            bid_amount: Number(bid.bid_amount),
          })),
          skipped_teams: skippedBids.map((bid: any) => ({
            team_name: bid.fantasy_team_name,
            team_id: bid.team_id,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      tiers: tierResults,
      total_tiers: tierResults.length,
      total_players_drafted: tierResults.reduce((sum, t) => sum + t.won_bids, 0),
    });
  } catch (error) {
    console.error('Error fetching tier draft results:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tier draft results', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
