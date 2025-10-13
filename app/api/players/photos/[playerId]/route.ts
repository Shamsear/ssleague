import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const playerId = params.playerId;

    // List blobs with player_id prefix
    const { blobs } = await list({
      prefix: `player-photos/${playerId}`,
    });

    if (blobs.length > 0) {
      return NextResponse.json({
        success: true,
        url: blobs[0].url,
        exists: true
      });
    }

    return NextResponse.json({
      success: true,
      url: '/images/player-placeholder.png',
      exists: false
    });
  } catch (error: any) {
    console.error('❌ Error getting photo URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get photo URL',
        url: '/images/player-placeholder.png'
      },
      { status: 500 }
    );
  }
}
