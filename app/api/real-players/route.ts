import { NextRequest, NextResponse } from 'next/server';
import {
  getAllRealPlayers,
  createRealPlayer,
  updateRealPlayer,
  getRealPlayerById,
} from '@/lib/firebase/realPlayers';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CreateRealPlayerData } from '@/types/realPlayer';

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
      is_registered: body.is_registered !== undefined ? body.is_registered : false,
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

/**
 * PATCH /api/real-players
 * Update an existing real player's registration status
 * Uses Admin SDK to bypass security rules
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.player_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player ID is required',
        },
        { status: 400 }
      );
    }
    
    // Query Firestore using Admin SDK to find player by player_id field
    const playersQuery = await adminDb
      .collection('realplayers')
      .where('player_id', '==', body.player_id)
      .limit(1)
      .get();
    
    if (playersQuery.empty) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player not found',
        },
        { status: 404 }
      );
    }
    
    // Get the document reference
    const playerDoc = playersQuery.docs[0];
    
    // Prepare update data
    const updateData: any = {
      updated_at: FieldValue.serverTimestamp(),
    };
    
    if (body.is_registered !== undefined) {
      updateData.is_registered = body.is_registered;
    }
    
    if (body.registered_at !== undefined) {
      updateData.registered_at = body.registered_at ? new Date(body.registered_at) : null;
    }
    
    if (body.season_id !== undefined) {
      updateData.season_id = body.season_id;
    }
    
    // Update using Admin SDK (bypasses security rules)
    await playerDoc.ref.update(updateData);
    
    return NextResponse.json(
      {
        success: true,
        message: 'Real player updated successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating real player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update real player',
      },
      { status: 500 }
    );
  }
}
