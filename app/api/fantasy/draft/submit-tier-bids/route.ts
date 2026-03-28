import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { getTiersFromDatabase } from '@/lib/fantasy/tier-generator';

/**
 * POST /api/fantasy/draft/submit-tier-bids
 * Submit bids for all tiers in the draft
 * 
 * Request Body:
 * {
 *   team_id: string;
 *   league_id: string;
 *   bids: Array<{
 *     tier_id: string;
 *     player_id?: string;
 *     bid_amount?: number;
 *     is_skip?: boolean;
 *   }>;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   message: string;
 *   total_bid_amount: number;
 *   tiers_skipped: number;
 *   deadline: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth([], request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: auth.error || 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { team_id, league_id, bids } = body;

    // Validate required parameters
    if (!team_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'team_id is required' 
        },
        { status: 400 }
      );
    }

    if (!league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'league_id is required' 
        },
        { status: 400 }
      );
    }

    if (!bids || !Array.isArray(bids) || bids.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'bids array is required and must not be empty' 
        },
        { status: 400 }
      );
    }

    console.log(`🎯 Processing tier bids for team: ${team_id}`);
    console.log(`   League: ${league_id}`);
    console.log(`   Number of bids: ${bids.length}`);
    console.log(`   Submitted by: ${auth.userId}`);

    // Verify team ownership
    const teams = await fantasySql`
      SELECT team_id, owner_uid, budget, league_id
      FROM fantasy_teams
      WHERE team_id = ${team_id}
      LIMIT 1
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Team not found' 
        },
        { status: 404 }
      );
    }

    const team = teams[0];

    // Verify ownership
    if (team.owner_uid !== auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'You do not own this team' 
        },
        { status: 403 }
      );
    }

    // Verify team is in the correct league
    if (team.league_id !== league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Team is not in this league' 
        },
        { status: 400 }
      );
    }

    // Get team's current budget
    const currentBudget = parseFloat(team.budget || '0');

    // Validate each bid
    let totalBidAmount = 0;
    let tiersSkipped = 0;
    const validatedBids = [];

    for (const bid of bids) {
      const { tier_id, player_id, bid_amount, is_skip } = bid;

      // Validate tier_id
      if (!tier_id) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Each bid must have a tier_id' 
          },
          { status: 400 }
        );
      }

      // Handle skip tier
      if (is_skip) {
        tiersSkipped++;
        validatedBids.push({
          tier_id,
          is_skip: true,
          bid_amount: 0
        });
        continue;
      }

      // Validate player_id and bid_amount for non-skip bids
      if (!player_id) {
        return NextResponse.json(
          { 
            success: false,
            error: `Bid for tier ${tier_id} must have a player_id or be marked as skip` 
          },
          { status: 400 }
        );
      }

      if (bid_amount === undefined || bid_amount === null) {
        return NextResponse.json(
          { 
            success: false,
            error: `Bid for tier ${tier_id} must have a bid_amount or be marked as skip` 
          },
          { status: 400 }
        );
      }

      // Validate bid amount is positive
      if (bid_amount < 0) {
        return NextResponse.json(
          { 
            success: false,
            error: `Bid amount must be non-negative (tier ${tier_id})` 
          },
          { status: 400 }
        );
      }

      totalBidAmount += bid_amount;

      validatedBids.push({
        tier_id,
        player_id,
        bid_amount,
        is_skip: false
      });
    }

    // Budget validation
    if (totalBidAmount > currentBudget) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Total bid amount exceeds available budget',
          total_bid_amount: totalBidAmount,
          available_budget: currentBudget,
          overage: totalBidAmount - currentBudget
        },
        { status: 400 }
      );
    }

    console.log(`💰 Total bid amount: ${totalBidAmount} (Budget: ${currentBudget})`);
    console.log(`⏭️  Tiers skipped: ${tiersSkipped}`);

    // Verify all tiers exist and belong to this league
    const tierIds = validatedBids.map(b => b.tier_id);
    const tiers = await fantasySql`
      SELECT tier_id, league_id, player_ids
      FROM fantasy_draft_tiers
      WHERE tier_id = ANY(${tierIds})
        AND league_id = ${league_id}
    `;

    if (tiers.length !== tierIds.length) {
      return NextResponse.json(
        { 
          success: false,
          error: 'One or more tier IDs are invalid' 
        },
        { status: 400 }
      );
    }

    // Validate player selections are in the correct tiers
    for (const bid of validatedBids) {
      if (bid.is_skip) continue;

      const tier = tiers.find(t => t.tier_id === bid.tier_id);
      if (!tier) continue;

      const playerIds = tier.player_ids as string[];
      if (!playerIds.includes(bid.player_id)) {
        return NextResponse.json(
          { 
            success: false,
            error: `Player ${bid.player_id} is not in tier ${bid.tier_id}` 
          },
          { status: 400 }
        );
      }
    }

    // Delete existing bids for this team (allow resubmission)
    await fantasySql`
      DELETE FROM fantasy_tier_bids
      WHERE team_id = ${team_id}
        AND league_id = ${league_id}
        AND tier_id = ANY(${tierIds})
    `;

    // Store bids in database
    for (const bid of validatedBids) {
      const bidId = `bid_${team_id}_${bid.tier_id}_${Date.now()}`;

      await fantasySql`
        INSERT INTO fantasy_tier_bids (
          bid_id, tier_id, league_id, team_id,
          player_id, bid_amount, is_skip, status, submitted_at
        ) VALUES (
          ${bidId},
          ${bid.tier_id},
          ${league_id},
          ${team_id},
          ${bid.player_id || null},
          ${bid.bid_amount},
          ${bid.is_skip},
          'pending',
          NOW()
        )
      `;
    }

    console.log(`✅ Successfully stored ${validatedBids.length} bids`);

    // Get draft deadline (if available)
    const leagues = await fantasySql`
      SELECT draft_closes_at
      FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    const deadline = leagues[0]?.draft_closes_at || null;

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${validatedBids.length} bids`,
      total_bid_amount: totalBidAmount,
      tiers_skipped: tiersSkipped,
      bids_submitted: validatedBids.length,
      deadline: deadline ? new Date(deadline).toISOString() : null
    });

  } catch (error) {
    console.error('❌ Error submitting tier bids:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to submit tier bids',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
