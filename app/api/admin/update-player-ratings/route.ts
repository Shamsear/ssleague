import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function POST(request: NextRequest) {
  try {
    // Verify committee admin auth
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { seasonId, updates } = body;

    if (!seasonId || !updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Update each player's star rating and points
    const results = [];
    for (const update of updates) {
      const { player_id, season_id, star_rating, points } = update;

      if (!player_id || !season_id || star_rating === undefined || points === undefined) {
        console.warn('Skipping invalid update:', update);
        continue;
      }

      try {
        const compositeId = `${player_id}_${season_id}`;
        
        await sql`
          UPDATE player_seasons
          SET star_rating = ${star_rating},
              points = ${points},
              updated_at = NOW()
          WHERE id = ${compositeId}
        `;

        results.push({
          player_id,
          season_id,
          star_rating,
          points,
          success: true
        });

        console.log(`✅ Updated ${player_id}: ${star_rating}⭐, ${points} pts`);
      } catch (error) {
        console.error(`Failed to update player ${player_id}:`, error);
        results.push({
          player_id,
          season_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} player(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results
    });
  } catch (error) {
    console.error('Error updating player ratings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update player ratings' },
      { status: 500 }
    );
  }
}
