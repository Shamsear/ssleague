import { NextRequest, NextResponse } from 'next/server';
import { getPlayerById, updatePlayer, deletePlayer } from '@/lib/neon/players';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const player = await getPlayerById(id);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: { player }
    });
  } catch (error: any) {
    console.error('Error fetching player:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const player = await updatePlayer(id, body);
    
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: player
    });
  } catch (error: any) {
    console.error('Error updating player:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deletePlayer(id);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Player deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting player:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
