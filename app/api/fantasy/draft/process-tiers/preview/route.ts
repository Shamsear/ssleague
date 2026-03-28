import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/draft/process-tiers/preview
 * Preview draft processing results without executing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, tier_number } = body;

    if (!league_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: league_id' },
        { status: 400 }
      );
    }

    // Get tiers for this league (all or specific tier)
    let tiers;
    if (tier_number) {
      tiers = await fantasySql`
        SELECT tier_id, tier_number, tier_name, player_count
        FROM fantasy_draft_tiers
        WHERE league_id = ${league_id} 
          AND draft_type = 'initial'
          AND tier_number = ${tier_number}
        ORDER BY tier_number ASC
      `;
    } else {
      tiers = await fantasySql`
        SELECT tier_id, tier_number, tier_name, player_count
        FROM fantasy_draft_tiers
        WHERE league_id = ${league_id} AND draft_type = 'initial'
        ORDER BY tier_number ASC
      `;
    }

    if (tiers.length === 0) {
      return NextResponse.json({
        success: false,
        error: tier_number 
          ? `Tier ${tier_number} not found. Please check the tier number.`
          : 'No draft tiers found. Please generate tiers first.',
      }, { status: 400 });
    }

    // Get all teams in the league
    const teams = await fantasySql`
      SELECT team_id, team_name, owner_name, budget_remaining
      FROM fantasy_teams
      WHERE fantasy_league_id = ${league_id}
    `;

    // Get all bids (filtered by tier if specified)
    let allBids;
    if (tier_number) {
      allBids = await fantasySql`
        SELECT 
          ftb.bid_id,
          ftb.tier_id,
          ftb.team_id,
          ftb.real_player_id,
          ftb.player_name,
          ftb.bid_amount,
          ftb.is_skip,
          ftb.submitted_at,
          ft.team_name,
          fdt.tier_number,
          fdt.tier_name
        FROM fantasy_tier_bids ftb
        JOIN fantasy_teams ft ON ftb.team_id = ft.team_id
        JOIN fantasy_draft_tiers fdt ON ftb.tier_id = fdt.tier_id
        WHERE ftb.league_id = ${league_id}
          AND fdt.tier_number = ${tier_number}
        ORDER BY fdt.tier_number, ftb.bid_amount DESC, ftb.submitted_at ASC
      `;
    } else {
      allBids = await fantasySql`
        SELECT 
          ftb.bid_id,
          ftb.tier_id,
          ftb.team_id,
          ftb.real_player_id,
          ftb.player_name,
          ftb.bid_amount,
          ftb.is_skip,
          ftb.submitted_at,
          ft.team_name,
          fdt.tier_number,
          fdt.tier_name
        FROM fantasy_tier_bids ftb
        JOIN fantasy_teams ft ON ftb.team_id = ft.team_id
        JOIN fantasy_draft_tiers fdt ON ftb.tier_id = fdt.tier_id
        WHERE ftb.league_id = ${league_id}
        ORDER BY fdt.tier_number, ftb.bid_amount DESC, ftb.submitted_at ASC
      `;
    }

    // Calculate bid summary
    const totalBids = allBids.filter((b: any) => !b.is_skip).length;
    const teamsWithBids = new Set(allBids.map((b: any) => b.team_id));
    const teamsWithoutBids = teams.filter((t: any) => !teamsWithBids.has(t.team_id));

    // Process tier by tier to predict winners
    const tierSummary = [];
    let totalBudgetToSpend = 0;
    const teamBudgets = new Map(teams.map((t: any) => [t.team_id, Number(t.budget_remaining)]));
    const teamWins = new Map<string, number>();

    for (const tier of tiers) {
      const tierBids = allBids.filter((b: any) => b.tier_id === tier.tier_id && !b.is_skip);
      const uniquePlayers = new Set(tierBids.map((b: any) => b.real_player_id)).size;

      // Group bids by player
      const bidsByPlayer = new Map<string, any[]>();
      tierBids.forEach((bid: any) => {
        if (!bidsByPlayer.has(bid.real_player_id)) {
          bidsByPlayer.set(bid.real_player_id, []);
        }
        bidsByPlayer.get(bid.real_player_id)!.push(bid);
      });

      // Predict winners for each player
      const predictedWinners = [];
      for (const [playerId, bids] of bidsByPlayer.entries()) {
        // Sort by bid amount (desc), then by submission time (asc)
        bids.sort((a, b) => {
          if (b.bid_amount !== a.bid_amount) {
            return b.bid_amount - a.bid_amount;
          }
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        });

        const winningBid = bids[0];
        const isTiebreaker = bids.length > 1 && bids[0].bid_amount === bids[1].bid_amount;

        predictedWinners.push({
          player_id: playerId,
          player_name: winningBid.player_name,
          winning_team: winningBid.team_name,
          team_id: winningBid.team_id,
          bid_amount: Number(winningBid.bid_amount),
          is_tiebreaker: isTiebreaker,
          competing_bids: bids.length,
        });

        // Track budget and wins
        totalBudgetToSpend += Number(winningBid.bid_amount);
        teamWins.set(winningBid.team_id, (teamWins.get(winningBid.team_id) || 0) + 1);
      }

      tierSummary.push({
        tier_number: tier.tier_number,
        tier_name: tier.tier_name,
        total_bids: tierBids.length,
        unique_players: uniquePlayers,
        players_available: tier.player_count,
        predicted_winners: predictedWinners.slice(0, 10), // Top 10 for preview
        total_winners: predictedWinners.length,
      });
    }

    // Calculate budget impact per team
    const teamBudgetImpact = [];
    const teamsOverBudget = [];
    
    for (const team of teams) {
      const wins = teamWins.get(team.team_id) || 0;
      let totalSpend = 0;

      // Calculate total spend for this team
      for (const tier of tierSummary) {
        const teamWin = tier.predicted_winners.find((w: any) => w.team_id === team.team_id);
        if (teamWin) {
          totalSpend += teamWin.bid_amount;
        }
      }

      const budgetRemaining = Number(team.budget_remaining);
      const newBudget = budgetRemaining - totalSpend;

      teamBudgetImpact.push({
        team_name: team.team_name,
        current_budget: budgetRemaining,
        total_spend: totalSpend,
        new_budget: newBudget,
        players_won: wins,
      });

      if (newBudget < 0) {
        teamsOverBudget.push({
          team_name: team.team_name,
          overspend: Math.abs(newBudget),
        });
      }
    }

    // Generate warnings
    const warnings = [];
    
    if (teamsWithoutBids.length > 0) {
      warnings.push({
        type: 'no_bids',
        severity: 'high',
        message: `${teamsWithoutBids.length} team(s) have not submitted any bids`,
        teams: teamsWithoutBids.map((t: any) => t.team_name),
      });
    }

    if (teamsOverBudget.length > 0) {
      warnings.push({
        type: 'over_budget',
        severity: 'critical',
        message: `${teamsOverBudget.length} team(s) will exceed their budget`,
        teams: teamsOverBudget,
      });
    }

    // Check for tiebreakers
    const tiebreakers = tierSummary.reduce((count, tier) => {
      return count + tier.predicted_winners.filter((w: any) => w.is_tiebreaker).length;
    }, 0);

    if (tiebreakers > 0) {
      warnings.push({
        type: 'tiebreakers',
        severity: 'medium',
        message: `${tiebreakers} player(s) have tied bids (earliest bid wins)`,
      });
    }

    return NextResponse.json({
      success: true,
      preview: {
        bid_summary: {
          total_bids: totalBids,
          total_teams: teams.length,
          teams_participated: teamsWithBids.size,
          teams_without_bids: teamsWithoutBids.map((t: any) => ({
            team_name: t.team_name,
            owner_name: t.owner_name,
          })),
        },
        tier_summary: tierSummary,
        budget_impact: {
          total_to_spend: totalBudgetToSpend,
          average_per_team: teams.length > 0 ? totalBudgetToSpend / teams.length : 0,
          team_breakdown: teamBudgetImpact,
          teams_over_budget: teamsOverBudget,
        },
        warnings,
        can_process: warnings.filter(w => w.severity === 'critical').length === 0,
      },
    });
  } catch (error) {
    console.error('Error generating draft preview:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate preview', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
