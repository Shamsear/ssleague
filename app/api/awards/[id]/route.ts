import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// PATCH - Update award Instagram link
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
      UPDATE awards
      SET instagram_link = ${instagram_link || null},
          instagram_post_url = ${instagram_post_url || null},
          updated_at = NOW()
      WHERE id = ${awardId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Award Instagram link updated successfully'
    });
  } catch (error) {
    console.error('Error updating award:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update award' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an award
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: awardId } = await params;

    await sql`
      DELETE FROM awards
      WHERE id = ${awardId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Award deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting award:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete award' },
      { status: 500 }
    );
  }
}
