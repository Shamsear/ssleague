import { NextRequest, NextResponse } from 'next/server';
import { deleteTrophy } from '@/lib/award-season-trophies';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// PATCH - Update trophy Instagram link
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getTournamentDb();
    const trophyId = params.id;
    const body = await request.json();
    const { instagram_link, instagram_post_url } = body;

    await sql`
      UPDATE team_trophies
      SET instagram_link = ${instagram_link || null},
          instagram_post_url = ${instagram_post_url || null}
      WHERE id = ${trophyId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Trophy Instagram link updated successfully'
    });
  } catch (error) {
    console.error('Error updating trophy:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update trophy' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trophyId = parseInt(params.id);

    if (isNaN(trophyId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid trophy ID' },
        { status: 400 }
      );
    }

    const result = await deleteTrophy(trophyId);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error deleting trophy:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
