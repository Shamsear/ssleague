/**
 * API: Fantasy Power-Ups
 * GET /api/fantasy/power-ups - Get power-up inventory and usage history
 * POST /api/fantasy/power-ups - Activate a power-up
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPowerUpInventory,
  getPowerUpUsageHistory,
  activatePowerUp,
  initializePowerUps,
  type PowerUpType
} from '@/lib/fantasy/power-ups';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    const leagueId = searchParams.get('league_id');
    const view = searchParams.get('view'); // 'history' or default

    if (!teamId || !leagueId) {
      return NextResponse.json(
        { error: 'team_id and league_id are required' },
        { status: 400 }
      );
    }

    // Get usage history
    if (view === 'history') {
      const history = await getPowerUpUsageHistory(leagueId, teamId);
      return NextResponse.json({
        success: true,
        team_id: teamId,
        league_id: leagueId,
        history
      });
    }

    // Get inventory (default)
    let inventory = await getPowerUpInventory(teamId, leagueId);

    // Initialize if not exists
    if (!inventory) {
      inventory = await initializePowerUps(teamId, leagueId);
    }

    return NextResponse.json({
      success: true,
      team_id: teamId,
      league_id: leagueId,
      inventory
    });

  } catch (error: any) {
    console.error('Error fetching power-ups:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch power-ups',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, league_id, round_id, power_up_type } = body;

    if (!team_id || !league_id || !round_id || !power_up_type) {
      return NextResponse.json(
        { error: 'team_id, league_id, round_id, and power_up_type are required' },
        { status: 400 }
      );
    }

    // Validate power-up type
    const validTypes: PowerUpType[] = ['triple_captain', 'bench_boost', 'free_hit', 'wildcard'];
    if (!validTypes.includes(power_up_type)) {
      return NextResponse.json(
        { error: 'Invalid power_up_type' },
        { status: 400 }
      );
    }

    // Activate power-up
    const result = await activatePowerUp(
      team_id,
      league_id,
      round_id,
      power_up_type as PowerUpType
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      usage_id: result.usage_id,
      remaining: result.remaining
    });

  } catch (error: any) {
    console.error('Error activating power-up:', error);
    return NextResponse.json(
      { 
        error: 'Failed to activate power-up',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
