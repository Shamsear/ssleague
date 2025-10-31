import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * DELETE /api/seasons/historical/[id]/cleanup
 * 
 * Deletes all data associated with a historical season import.
 * Use this to clean up after a failed import so you can retry.
 * 
 * Deletes:
 * - Neon: teamstats, realplayerstats, player_awards, team_trophies
 * - Firebase: season document, teams (if created during this import), realplayers stats
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const seasonId = resolvedParams.id;
    
    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    console.log(`🧹 Starting cleanup for season: ${seasonId}`);

    const sql = getTournamentDb();
    let deletedCount = {
      teamstats: 0,
      realplayerstats: 0,
      player_awards: 0,
      team_trophies: 0,
      firebase_season: 0
    };

    // 1. Delete from Neon tournament database
    console.log('🗑️  Deleting from Neon database...');

    // Delete team trophies
    const trophiesResult = await sql`
      DELETE FROM team_trophies 
      WHERE season_id = ${seasonId}
    `;
    deletedCount.team_trophies = trophiesResult.count || 0;
    console.log(`   ✅ Deleted ${deletedCount.team_trophies} team trophies`);

    // Delete player awards
    const awardsResult = await sql`
      DELETE FROM player_awards 
      WHERE season_id = ${seasonId}
    `;
    deletedCount.player_awards = awardsResult.count || 0;
    console.log(`   ✅ Deleted ${deletedCount.player_awards} player awards`);

    // Delete team stats
    const teamstatsResult = await sql`
      DELETE FROM teamstats 
      WHERE season_id = ${seasonId}
    `;
    deletedCount.teamstats = teamstatsResult.count || 0;
    console.log(`   ✅ Deleted ${deletedCount.teamstats} team stats records`);

    // Delete player stats
    const playerstatsResult = await sql`
      DELETE FROM realplayerstats 
      WHERE season_id = ${seasonId}
    `;
    deletedCount.realplayerstats = playerstatsResult.count || 0;
    console.log(`   ✅ Deleted ${deletedCount.realplayerstats} player stats records`);

    // 2. Delete from Firebase
    console.log('🗑️  Deleting from Firebase...');

    // Delete season document
    try {
      await adminDb.collection('seasons').doc(seasonId).delete();
      deletedCount.firebase_season = 1;
      console.log(`   ✅ Deleted season document`);
    } catch (error) {
      console.log(`   ⚠️  Season document not found or already deleted`);
    }

    // Note: We don't delete teams, players, users, or Firebase stats
    // Those may be used across multiple seasons
    // Only cleaning up season-specific data in Neon

    console.log('✅ Cleanup completed successfully');
    console.log('Summary:', deletedCount);

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up season ${seasonId}`,
      deleted: deletedCount,
      note: 'Teams and players were not deleted as they may be used in other seasons'
    });

  } catch (error: any) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to cleanup season data',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
