import { NextRequest, NextResponse } from 'next/server';
import { deleteTrophy } from '@/lib/award-season-trophies';

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
