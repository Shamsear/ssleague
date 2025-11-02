import { NextRequest, NextResponse } from 'next/server';
import { bulkUpdateEligibility, bulkImportPlayers, bulkUpdatePlayerStats, deleteAllPlayers } from '@/lib/neon/players';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, playerIds, isEligible, players } = body;

    // Get season_id from authenticated user (for committee admins)
    let seasonId: string | null = null;
    try {
      const cookieStore = await cookies();
      const session = cookieStore.get('session')?.value;
      if (session) {
        const decodedClaims = await adminAuth.verifySessionCookie(session, true);
        if (decodedClaims.role === 'committee_admin' && decodedClaims.seasonId) {
          seasonId = decodedClaims.seasonId;
        }
      }
    } catch (authError) {
      console.log('Auth check for season_id failed:', authError);
    }

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
        // Add season_id to all players if available
        const playersWithSeason = players.map(player => ({
          ...player,
          season_id: player.season_id || seasonId
        }));
        const importCount = await bulkImportPlayers(playersWithSeason);
        return NextResponse.json({
          success: true,
          message: `Imported ${importCount} players`,
          count: importCount
        });

      case 'updateStats':
        if (!players || !Array.isArray(players)) {
          return NextResponse.json(
            { success: false, error: 'players array is required' },
            { status: 400 }
          );
        }
        // Add season_id to NEW players only (existing players keep their season_id)
        const playersWithSeasonForUpdate = players.map(player => ({
          ...player,
          season_id: player.season_id || seasonId
        }));
        const updateResult = await bulkUpdatePlayerStats(playersWithSeasonForUpdate);
        return NextResponse.json({
          success: true,
          message: `Updated ${updateResult.updated} players, inserted ${updateResult.inserted} new players`,
          updated: updateResult.updated,
          inserted: updateResult.inserted,
          errors: updateResult.errors
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
