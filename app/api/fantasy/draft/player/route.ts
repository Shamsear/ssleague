import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { triggerNews } from '@/lib/news/trigger';
import { broadcastFantasyDraftUpdate } from '@/lib/realtime/broadcast';

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

    // Validation 1: Check if already drafted by THIS team
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

    // Update fantasy_players: increment times_drafted, mark as unavailable
    const existingPlayer = await fantasySql`
      SELECT * FROM fantasy_players
      WHERE league_id = ${leagueId} AND real_player_id = ${real_player_id}
      LIMIT 1
    `;

    if (existingPlayer.length > 0) {
      // Player exists - update times_drafted and mark unavailable
      await fantasySql`
        UPDATE fantasy_players
        SET 
          times_drafted = COALESCE(times_drafted, 0) + 1,
          is_available = false,
          updated_at = NOW()
        WHERE league_id = ${leagueId} AND real_player_id = ${real_player_id}
      `;
    } else {
      // Player doesn't exist - create record
      await fantasySql`
        INSERT INTO fantasy_players (
          league_id, real_player_id, draft_price,
          times_drafted, total_points, is_available
        ) VALUES (
          ${leagueId}, ${real_player_id}, ${draft_price},
          1, 0, false
        )
      `;
    }

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

    // Trigger news for fantasy draft milestone (every 10 drafts)
    if ((currentSquad.length + 1) % 10 === 0) {
      try {
        await triggerNews('fantasy_draft', {
          season_id: league.season_id || null,
          league_id: leagueId,
          total_drafted: currentSquad.length + 1,
          player_name,
          team_name: team.team_name,
        });
      } catch (newsError) {
        console.error('Failed to generate fantasy draft news:', newsError);
      }
    }

    // Broadcast to Firebase Realtime DB
    await broadcastFantasyDraftUpdate(leagueId, {
      type: 'player_drafted',
      team_id: teamId,
      player_name,
      position,
      draft_price,
    });

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

/**
 * DELETE /api/fantasy/draft/player
 * Remove a drafted player from squad (during draft period only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const real_player_id = searchParams.get('real_player_id');

    if (!user_id || !real_player_id) {
      return NextResponse.json(
        { error: 'Missing required parameters: user_id, real_player_id' },
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

    // Get league settings to check draft status
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

    // Check if draft is active (only allow removal during draft)
    if (league.draft_status !== 'active') {
      return NextResponse.json(
        { 
          error: `Cannot remove players when draft is ${league.draft_status}`,
          message: 'Players can only be removed during active draft period'
        },
        { status: 403 }
      );
    }

    // Get the player from squad
    const squadPlayer = await fantasySql`
      SELECT * FROM fantasy_squad
      WHERE team_id = ${teamId}
        AND real_player_id = ${real_player_id}
      LIMIT 1
    `;

    if (squadPlayer.length === 0) {
      return NextResponse.json(
        { error: 'Player not found in squad' },
        { status: 404 }
      );
    }

    const player = squadPlayer[0];
    const refundPrice = Number(player.purchase_price);

    // Remove from fantasy_squad
    await fantasySql`
      DELETE FROM fantasy_squad
      WHERE team_id = ${teamId}
        AND real_player_id = ${real_player_id}
    `;

    // Update team's budget (refund the price)
    await fantasySql`
      UPDATE fantasy_teams
      SET budget_remaining = budget_remaining + ${refundPrice},
          updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ${teamId}
    `;

    console.log(`✅ Undrafted player: ${player.player_name} from team ${teamId}, refunded $${refundPrice}M`);

    // Broadcast to Firebase Realtime DB
    await broadcastFantasyDraftUpdate(leagueId, {
      type: 'player_undrafted',
      team_id: teamId,
      player_name: player.player_name,
      refunded_amount: refundPrice,
    });

    return NextResponse.json({
      success: true,
      message: 'Player removed from squad',
      refunded_amount: refundPrice,
      player_name: player.player_name
    });
  } catch (error) {
    console.error('Error removing player:', error);
    return NextResponse.json(
      { error: 'Failed to remove player', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
