import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/draft/player
 * Draft a player for a fantasy team
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      real_player_id,
      player_name,
      position,
      team_name,
      draft_price,
    } = body;

    if (!user_id || !real_player_id) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, real_player_id' },
        { status: 400 }
      );
    }

    // Get user's fantasy team
    const fantasyTeams = await fantasySql`
      SELECT * FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `;

    if (fantasyTeams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found for this user' },
        { status: 404 }
      );
    }

    const team = fantasyTeams[0];
    const teamId = team.team_id;
    const leagueId = team.league_id;

    // Get league settings
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${leagueId}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    const league = leagues[0];
    const maxSquadSize = Number(league.max_squad_size);
    const budgetPerTeam = Number(league.budget_per_team);

    // Check if draft is active
    if (league.draft_status !== 'active') {
      return NextResponse.json(
        { 
          error: `Draft is currently ${league.draft_status}`,
          draft_status: league.draft_status,
          message: league.draft_status === 'pending' 
            ? 'Draft has not started yet' 
            : 'Draft period has ended. Use transfer windows to modify your squad.'
        },
        { status: 403 }
      );
    }

    // Check if within draft period
    const now = new Date();
    if (league.draft_closes_at) {
      const closeDate = new Date(league.draft_closes_at);
      if (now > closeDate) {
        return NextResponse.json(
          { 
            error: 'Draft period has ended',
            closed_at: league.draft_closes_at
          },
          { status: 403 }
        );
      }
    }

    // Get current squad
    const currentSquad = await fantasySql`
      SELECT * FROM fantasy_squad
      WHERE team_id = ${teamId}
    `;

    // Validation 1: Check if already drafted
    const alreadyDrafted = currentSquad.some(
      (p: any) => p.real_player_id === real_player_id
    );

    if (alreadyDrafted) {
      return NextResponse.json(
        { error: 'Player already in your squad' },
        { status: 400 }
      );
    }

    // Validation 2: Check squad size
    if (currentSquad.length >= maxSquadSize) {
      return NextResponse.json(
        {
          error: 'Squad is full',
          current_size: currentSquad.length,
          max_size: maxSquadSize,
        },
        { status: 400 }
      );
    }

    // Validation 3: Check budget
    const currentBudgetSpent = currentSquad.reduce(
      (sum: number, p: any) => sum + Number(p.purchase_price),
      0
    );
    const remainingBudget = budgetPerTeam - currentBudgetSpent;

    if (draft_price > remainingBudget) {
      return NextResponse.json(
        {
          error: 'Insufficient budget',
          required: draft_price,
          available: remainingBudget,
        },
        { status: 400 }
      );
    }

    // Generate unique squad_id
    const squad_id = `squad_${teamId}_${real_player_id}_${Date.now()}`;
    const draft_id = `draft_${teamId}_${real_player_id}_${Date.now()}`;

    // Add to fantasy_squad
    await fantasySql`
      INSERT INTO fantasy_squad (
        squad_id, team_id, league_id, real_player_id,
        player_name, position, real_team_name,
        purchase_price, current_value, acquisition_type
      ) VALUES (
        ${squad_id}, ${teamId}, ${leagueId}, ${real_player_id},
        ${player_name}, ${position || 'Unknown'}, ${team_name || 'Unknown'},
        ${draft_price}, ${draft_price}, 'draft'
      )
    `;

    // Record in fantasy_drafts for history
    await fantasySql`
      INSERT INTO fantasy_drafts (
        draft_id, league_id, team_id, real_player_id,
        player_name, position, real_team_name, draft_price,
        draft_order
      ) VALUES (
        ${draft_id}, ${leagueId}, ${teamId}, ${real_player_id},
        ${player_name}, ${position || 'Unknown'}, ${team_name || 'Unknown'},
        ${draft_price}, ${currentSquad.length + 1}
      )
    `;

    // Update team's budget remaining
    const newBudgetRemaining = remainingBudget - draft_price;
    await fantasySql`
      UPDATE fantasy_teams
      SET budget_remaining = ${newBudgetRemaining},
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Player drafted successfully',
      squad_player: {
        squad_id,
        player_name,
        position,
        purchase_price: draft_price,
      },
      remaining_budget: newBudgetRemaining,
      squad_size: currentSquad.length + 1,
      max_squad_size: maxSquadSize,
    });
  } catch (error) {
    console.error('Error drafting player:', error);
    return NextResponse.json(
      { error: 'Failed to draft player', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
