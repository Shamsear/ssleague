import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { seasonId, players } = await request.json();

    if (!seasonId || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'Missing required fields: seasonId and players array' },
        { status: 400 }
      );
    }

    const batch = adminDb.batch();

    for (const player of players) {
      const { id, starRating, categoryId, categoryName } = player;
      
      if (!id) continue;

      const playerRef = adminDb.collection('realplayer').doc(id);
      
      batch.update(playerRef, {
        star_rating: starRating,
        category_id: categoryId || '',
        category_name: categoryName || '',
        updated_at: new Date().toISOString(),
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${players.length} players with ratings and categories`,
    });
  } catch (error) {
    console.error('Error assigning player ratings:', error);
    return NextResponse.json(
      { error: 'Failed to assign player ratings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
