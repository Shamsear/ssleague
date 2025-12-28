import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// PATCH - Update player award Instagram link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: awardId } = await params;
    const body = await request.json();
    const { instagram_link, instagram_post_url } = body;

    await sql`
      UPDATE player_awards
      SET instagram_link = ${instagram_link || null},
          instagram_post_url = ${instagram_post_url || null},
          updated_at = NOW()
      WHERE id = ${awardId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Player award Instagram link updated successfully'
    });
  } catch (error) {
    console.error('Error updating player award:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update player award' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a player award
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: awardId } = await params;

    // Get award details before deleting (to update awards_count)
    const award = await sql`
      SELECT player_id, season_id
      FROM player_awards
      WHERE id = ${awardId}
    `;

    if (award.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Award not found' },
        { status: 404 }
      );
    }

    const { player_id, season_id } = award[0];

    // Delete the award
    await sql`
      DELETE FROM player_awards
      WHERE id = ${awardId}
    `;

    // Update player_season awards_count (decrement)
    await sql`
      UPDATE player_season
      SET 
        awards_count = GREATEST(COALESCE(awards_count, 0) - 1, 0),
        updated_at = NOW()
      WHERE player_id = ${player_id} AND season_id = ${season_id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Player award deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting player award:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete player award' },
      { status: 500 }
    );
  }
}
