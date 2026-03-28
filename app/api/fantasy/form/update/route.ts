/**
 * API: Update Player Form
 * 
 * POST /api/fantasy/form/update
 * 
 * Updates form status for all players in a league based on last 5 performances.
 * Should be run after each round completes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackAllPlayersForm, trackPlayerForm } from '@/lib/fantasy/form-tracker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, player_id } = body;

    // Validate input
    if (!league_id && !player_id) {
      return NextResponse.json(
        { error: 'Either league_id or player_id is required' },
        { status: 400 }
      );
    }

    let result;

    if (player_id) {
      // Update single player
      const formData = await trackPlayerForm(player_id);
      result = {
        success: true,
        player_id,
        form_data: formData,
        message: `Form updated for player ${player_id}`
      };
    } else {
      // Update all players in league
      const updatedCount = await trackAllPlayersForm(league_id);
      result = {
        success: true,
        league_id,
        players_updated: updatedCount,
        message: `Form updated for ${updatedCount} players`
      };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Form update error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update player form',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fantasy/form/update
 * 
 * Get form data for a player
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('player_id');

    if (!playerId) {
      return NextResponse.json(
        { error: 'player_id is required' },
        { status: 400 }
      );
    }

    const formData = await trackPlayerForm(playerId);

    return NextResponse.json({
      success: true,
      player_id: playerId,
      form_data: formData
    });

  } catch (error) {
    console.error('Form fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch player form',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
