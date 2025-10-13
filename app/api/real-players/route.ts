import { NextRequest, NextResponse } from 'next/server';
import {
  getAllRealPlayers,
  createRealPlayer,
  CreateRealPlayerData,
} from '@/lib/firebase/realPlayers';

/**
 * GET /api/real-players
 * Get all real players
 */
export async function GET() {
  try {
    const players = await getAllRealPlayers();
    
    return NextResponse.json({
      success: true,
      data: players,
      count: players.length,
    });
  } catch (error: any) {
    console.error('Error fetching real players:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch real players',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/real-players
 * Create a new real player
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player name is required',
        },
        { status: 400 }
      );
    }
    
    const playerData: CreateRealPlayerData = {
      name: body.name.trim(),
      team: body.team || null,
      season_id: body.season_id || null,
      category_id: body.category_id || null,
      team_id: body.team_id || null,
      is_registered: body.is_registered || false,
      display_name: body.display_name || null,
      email: body.email || null,
      phone: body.phone || null,
      role: body.role || 'player',
      psn_id: body.psn_id || null,
      xbox_id: body.xbox_id || null,
      steam_id: body.steam_id || null,
      notes: body.notes || null,
    };
    
    const player = await createRealPlayer(playerData, body.assigned_by);
    
    return NextResponse.json(
      {
        success: true,
        data: player,
        message: 'Real player created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating real player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create real player',
      },
      { status: 500 }
    );
  }
}
