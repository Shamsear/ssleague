import { NextRequest, NextResponse } from 'next/server';
import { bulkUpdateEligibility, bulkImportPlayers, deleteAllPlayers } from '@/lib/neon/players';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, playerIds, isEligible, players } = body;

    switch (action) {
      case 'updateEligibility':
        if (!playerIds || typeof isEligible !== 'boolean') {
          return NextResponse.json(
            { success: false, error: 'playerIds and isEligible are required' },
            { status: 400 }
          );
        }
        const updateCount = await bulkUpdateEligibility(playerIds, isEligible);
        return NextResponse.json({
          success: true,
          message: `Updated ${updateCount} players`,
          count: updateCount
        });

      case 'import':
        if (!players || !Array.isArray(players)) {
          return NextResponse.json(
            { success: false, error: 'players array is required' },
            { status: 400 }
          );
        }
        const importCount = await bulkImportPlayers(players);
        return NextResponse.json({
          success: true,
          message: `Imported ${importCount} players`,
          count: importCount
        });

      case 'deleteAll':
        const deleteCount = await deleteAllPlayers();
        return NextResponse.json({
          success: true,
          message: `Deleted ${deleteCount} players`,
          count: deleteCount
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in bulk operation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
