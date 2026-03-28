import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/draft/my-results?team_id=xxx&league_id=xxx
 * Get draft results for a specific team
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
        { error: 'Missing team_id or league_id parameter' },
        { status: 400 }
      );
    }

    // Verify team ownership
    const teams = await fantasySql`
      SELECT team_id, owner_uid, team_name, budget, budget_remaining, squad_size
      FROM fantasy_teams
      WHERE team_id = ${teamId} AND league_id = ${leagueId}
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    const team = teams[0];

    // Verify ownership
    if (team.owner_uid !== auth.user?.uid) {
      return NextResponse.json(
        { error: 'Forbidden: Not your team' },
        { status: 403 }
      );
    }

    // Get all bids for this team with tier information
    const bids = await fantasySql`
      SELECT 
        b.bid_id,
        b.tier_id,
        b.player_id,
        b.bid_amount,
        b.is_skip,
        b.status,
        b.submitted_at,
        b.processed_at,
        t.tier_number,
        t.tier_name,
        p.player_name,
        p.position,
        p.real_team_name,
        p.total_points
      FROM fantasy_tier_bids b
      JOIN fantasy_draft_tiers t ON b.tier_id = t.tier_id
      LEFT JOIN fantasy_players p ON b.player_id = p.real_player_id
      WHERE b.team_id = ${teamId} AND b.league_id = ${leagueId}
      ORDER BY t.tier_number ASC
    `;

    // Get final squad
    const squad = await fantasySql`
      SELECT 
        fs.real_player_id,
        fs.player_name,
        fs.position,
        fs.real_team_name,
        fs.purchase_price,
        fs.acquisition_tier,
        fs.total_points,
        fp.games_played,
        fp.avg_points_per_game
      FROM fantasy_squad fs
      LEFT JOIN fantasy_players fp ON fs.real_player_id = fp.real_player_id
      WHERE fs.team_id = ${teamId}
      ORDER BY fs.acquisition_tier ASC, fs.purchase_price DESC
    `;

    // Calculate stats
    const wonBids = bids.filter(b => b.status === 'won');
    const lostBids = bids.filter(b => b.status === 'lost');
    const skippedTiers = bids.filter(b => b.is_skip || b.status === 'skipped');
    
    const budgetSpent = parseFloat(team.budget || '100') - parseFloat(team.budget_remaining || '100');

    return NextResponse.json({
      success: true,
      team: {
        team_id: team.team_id,
        team_name: team.team_name,
        budget: parseFloat(team.budget || '100'),
        budget_remaining: parseFloat(team.budget_remaining || '100'),
        budget_spent: budgetSpent,
        squad_size: team.squad_size || 0
      },
      bids: bids.map(b => ({
        bid_id: b.bid_id,
        tier_id: b.tier_id,
        tier_number: b.tier_number,
        tier_name: b.tier_name,
        player_id: b.player_id,
        player_name: b.player_name,
        position: b.position,
        real_team_name: b.real_team_name,
        total_points: b.total_points ? parseFloat(b.total_points) : 0,
        bid_amount: b.bid_amount ? parseFloat(b.bid_amount) : 0,
        is_skip: b.is_skip,
        status: b.status,
        submitted_at: b.submitted_at,
        processed_at: b.processed_at
      })),
      squad: squad.map(p => ({
        real_player_id: p.real_player_id,
        player_name: p.player_name,
        position: p.position,
        real_team_name: p.real_team_name,
        purchase_price: parseFloat(p.purchase_price || '0'),
        acquisition_tier: p.acquisition_tier,
        total_points: parseFloat(p.total_points || '0'),
        games_played: p.games_played || 0,
        avg_points_per_game: p.avg_points_per_game ? parseFloat(p.avg_points_per_game) : 0
      })),
      stats: {
        total_bids: bids.length,
        won: wonBids.length,
        lost: lostBids.length,
        skipped: skippedTiers.length,
        budget_spent: budgetSpent,
        budget_remaining: parseFloat(team.budget_remaining || '100'),
        squad_size: team.squad_size || 0
      }
    });

  } catch (error) {
    console.error('Error fetching draft results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft results' },
      { status: 500 }
    );
  }
}
