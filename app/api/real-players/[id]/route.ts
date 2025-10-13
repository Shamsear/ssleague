import { NextRequest, NextResponse } from 'next/server';
import {
  getRealPlayerById,
  updateRealPlayer,
  deleteRealPlayer,
  UpdateRealPlayerData,
} from '@/lib/firebase/realPlayers';

/**
 * GET /api/real-players/[id]
 * Get a single real player by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const player = await getRealPlayerById(params.id);
    
    if (!player) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: player,
    });
  } catch (error: any) {
    console.error('Error fetching real player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch real player',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/real-players/[id]
 * Update a real player
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const updates: UpdateRealPlayerData = {};
    
    // Only include fields that are provided
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.team !== undefined) updates.team = body.team;
    if (body.season_id !== undefined) updates.season_id = body.season_id;
    if (body.category_id !== undefined) updates.category_id = body.category_id;
    if (body.team_id !== undefined) updates.team_id = body.team_id;
    if (body.is_registered !== undefined) updates.is_registered = body.is_registered;
    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.role !== undefined) updates.role = body.role;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.is_available !== undefined) updates.is_available = body.is_available;
    if (body.psn_id !== undefined) updates.psn_id = body.psn_id;
    if (body.xbox_id !== undefined) updates.xbox_id = body.xbox_id;
    if (body.steam_id !== undefined) updates.steam_id = body.steam_id;
    if (body.notes !== undefined) updates.notes = body.notes;
    
    await updateRealPlayer(params.id, updates);
    
    // Fetch updated player
    const updatedPlayer = await getRealPlayerById(params.id);
    
    return NextResponse.json({
      success: true,
      data: updatedPlayer,
      message: 'Real player updated successfully',
    });
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

/**
 * DELETE /api/real-players/[id]
 * Delete a real player
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteRealPlayer(params.id);
    
    return NextResponse.json({
      success: true,
      message: 'Real player deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting real player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete real player',
      },
      { status: 500 }
    );
  }
}
