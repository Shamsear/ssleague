import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/admin/cleanup-firebase-fantasy
 * Delete all fantasy-related data from Firebase
 * 
 * This endpoint should only be called by super admins
 * The fantasy system has been migrated to PostgreSQL
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth from request (add your auth check here)
    // For now, requiring a secret key
    const body = await request.json();
    const { confirm_delete } = body;

    if (confirm_delete !== 'DELETE_ALL_FANTASY_DATA') {
      return NextResponse.json(
        { error: 'Confirmation phrase required. Send: confirm_delete: "DELETE_ALL_FANTASY_DATA"' },
        { status: 400 }
      );
    }

    const collections = [
      'fantasy_leagues',
      'fantasy_teams',
      'fantasy_drafts',
      'fantasy_squad',
      'fantasy_player_points',
      'fantasy_scoring_rules',
      'fantasy_transfers',
      'fantasy_player_prices',
      'fantasy_leaderboard',
    ];

    const stats: Record<string, number> = {};
    let grandTotal = 0;

    for (const collectionName of collections) {
      console.log(`Deleting collection: ${collectionName}`);
      const deleted = await deleteCollection(collectionName);
      stats[collectionName] = deleted;
      grandTotal += deleted;
    }

    return NextResponse.json({
      success: true,
      message: 'Firebase fantasy data cleanup complete',
      stats,
      total_deleted: grandTotal,
    });
  } catch (error) {
    console.error('Error cleaning up fantasy data:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup fantasy data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = adminDb.collection(collectionName);
  const batchSize = 500;
  let totalDeleted = 0;

  try {
    let snapshot = await collectionRef.limit(batchSize).get();

    while (!snapshot.empty) {
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;
      console.log(`   Deleted ${snapshot.size} documents from ${collectionName} (total: ${totalDeleted})`);

      // Fetch next batch
      snapshot = await collectionRef.limit(batchSize).get();
    }

    console.log(`✅ Completed: ${collectionName} - ${totalDeleted} documents deleted`);
    return totalDeleted;
  } catch (error) {
    console.error(`Error deleting ${collectionName}:`, error);
    return totalDeleted;
  }
}
