import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import * as admin from 'firebase-admin';

/**
 * GET - List all real players with unnecessary user fields
 * POST - Remove unnecessary user fields from real players
 */

const UNNECESSARY_FIELDS = [
  'user_id',
  'registered_user_id',
  'isActive',
  'createdAt',
  'updatedAt'
];

export async function GET(request: NextRequest) {
  try {
    // Verify super admin authorization
    const auth = await verifyAuth(['super_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 Scanning real players for unnecessary fields...');

    // Get all real players
    const playersSnapshot = await adminDb.collection('realplayers').get();
    
    const playersWithIssues: any[] = [];
    const fieldCounts: { [key: string]: number } = {};
    
    // Initialize counts
    UNNECESSARY_FIELDS.forEach(field => {
      fieldCounts[field] = 0;
    });

    playersSnapshot.forEach(doc => {
      const data = doc.data();
      const foundFields: string[] = [];
      
      // Check which unnecessary fields exist
      UNNECESSARY_FIELDS.forEach(field => {
        if (data[field] !== undefined) {
          foundFields.push(field);
          fieldCounts[field]++;
        }
      });
      
      // If any unnecessary fields found, add to list
      if (foundFields.length > 0) {
        playersWithIssues.push({
          player_id: data.player_id || doc.id,
          name: data.name,
          unnecessary_fields: foundFields,
          field_values: foundFields.reduce((acc, field) => {
            acc[field] = data[field];
            return acc;
          }, {} as any)
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        total_players: playersSnapshot.size,
        players_with_issues: playersWithIssues.length,
        field_counts: fieldCounts,
        players: playersWithIssues,
        unnecessary_fields: UNNECESSARY_FIELDS
      },
      message: `Found ${playersWithIssues.length} players with unnecessary fields`
    });
  } catch (error: any) {
    console.error('Error scanning real players:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to scan real players' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify super admin authorization
    const auth = await verifyAuth(['super_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { confirm, player_ids } = body;

    if (!confirm) {
      return NextResponse.json(
        { success: false, error: 'Please confirm the cleanup operation' },
        { status: 400 }
      );
    }

    console.log('🧹 Starting cleanup of real players...');

    // Get all real players or specific ones
    let playersQuery = adminDb.collection('realplayers');
    let playersSnapshot;
    
    if (player_ids && Array.isArray(player_ids) && player_ids.length > 0) {
      // Clean up specific players
      console.log(`Cleaning up ${player_ids.length} specific players`);
      const playerDocs = await Promise.all(
        player_ids.map(id => adminDb.collection('realplayers').doc(id).get())
      );
      playersSnapshot = { docs: playerDocs.filter(doc => doc.exists) };
    } else {
      // Clean up all players
      playersSnapshot = await playersQuery.get();
    }

    let cleanedCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];

    // Use batched writes for efficiency
    const batchSize = 500;
    let batch = adminDb.batch();
    let operationCount = 0;

    for (const doc of playersSnapshot.docs) {
      const data = doc.data();
      const fieldsToRemove: { [key: string]: any } = {};
      let hasFieldsToRemove = false;

      // Check which fields need to be removed
      UNNECESSARY_FIELDS.forEach(field => {
        if (data[field] !== undefined) {
          fieldsToRemove[field] = admin.firestore.FieldValue.delete();
          hasFieldsToRemove = true;
        }
      });

      if (hasFieldsToRemove) {
        try {
          batch.update(doc.ref, fieldsToRemove);
          operationCount++;
          cleanedCount++;

          // Commit batch if it reaches the limit
          if (operationCount >= batchSize) {
            await batch.commit();
            console.log(`✅ Committed batch of ${operationCount} updates`);
            batch = adminDb.batch();
            operationCount = 0;
          }
        } catch (error: any) {
          errors.push({
            player_id: data.player_id || doc.id,
            name: data.name,
            error: error.message
          });
        }
      } else {
        skippedCount++;
      }
    }

    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${operationCount} updates`);
    }

    console.log(`✅ Cleanup complete: ${cleanedCount} cleaned, ${skippedCount} skipped`);

    return NextResponse.json({
      success: true,
      data: {
        cleaned_count: cleanedCount,
        skipped_count: skippedCount,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Successfully cleaned ${cleanedCount} players. ${skippedCount} players had no issues.`
    });
  } catch (error: any) {
    console.error('Error cleaning up real players:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clean up real players' },
      { status: 500 }
    );
  }
}
