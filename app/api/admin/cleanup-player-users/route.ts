import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';

/**
 * GET - List all user accounts with role = "player"
 * DELETE - Delete user accounts from Firebase Auth and Firestore
 */

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

    console.log('🔍 Scanning for user accounts linked to real players...');

    // Step 1: Get all real players with registered_user_id
    const realPlayersSnapshot = await adminDb.collection('realplayers').get();
    const registeredUserIds = new Set<string>();
    
    realPlayersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.registered_user_id) {
        registeredUserIds.add(data.registered_user_id);
      }
    });

    console.log(`Found ${registeredUserIds.size} real players with registered_user_id`);

    // Step 2: Get all users from Firestore
    const usersSnapshot = await adminDb.collection('users').get();
    
    const playerUsers: any[] = [];
    let totalUsers = 0;

    usersSnapshot.forEach(doc => {
      totalUsers++;
      const uid = doc.id;
      const data = doc.data();
      
      // Check if this user ID is linked to a real player
      if (registeredUserIds.has(uid)) {
        playerUsers.push({
          uid: uid,
          email: data.email,
          displayName: data.displayName || data.name,
          role: data.role,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        });
      }
    });

    console.log(`Found ${playerUsers.length} user accounts linked to real players out of ${totalUsers} total users`);

    return NextResponse.json({
      success: true,
      data: {
        total_users: totalUsers,
        player_users_count: playerUsers.length,
        player_users: playerUsers,
      },
      message: `Found ${playerUsers.length} user accounts linked to real players`
    });
  } catch (error: any) {
    console.error('Error scanning users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to scan users' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { confirm, user_ids } = body;

    if (!confirm) {
      return NextResponse.json(
        { success: false, error: 'Please confirm the deletion operation' },
        { status: 400 }
      );
    }

    console.log('🗑️  Starting deletion of player user accounts...');

    let usersToDelete: string[] = [];

    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      // Delete specific users
      usersToDelete = user_ids;
      console.log(`Deleting ${user_ids.length} specific user accounts`);
    } else {
      // Delete all users linked to real players
      const realPlayersSnapshot = await adminDb.collection('realplayers').get();
      const registeredUserIds = new Set<string>();
      
      realPlayersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.registered_user_id) {
          registeredUserIds.add(data.registered_user_id);
        }
      });
      
      usersToDelete = Array.from(registeredUserIds);
      console.log(`Deleting all ${usersToDelete.length} user accounts linked to real players`);
    }

    let deletedCount = 0;
    let authDeletedCount = 0;
    let firestoreDeletedCount = 0;
    const errors: any[] = [];

    // Use batched writes for Firestore
    const batchSize = 500;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const uid of usersToDelete) {
      try {
        // Delete from Firebase Auth
        try {
          await adminAuth.deleteUser(uid);
          authDeletedCount++;
          console.log(`  ✅ Deleted from Auth: ${uid}`);
        } catch (authError: any) {
          // User might not exist in Auth, that's okay
          if (authError.code !== 'auth/user-not-found') {
            console.log(`  ⚠️  Auth deletion failed for ${uid}: ${authError.message}`);
          }
        }

        // Delete from Firestore
        const userRef = adminDb.collection('users').doc(uid);
        batch.delete(userRef);
        batchCount++;
        firestoreDeletedCount++;

        // Commit batch if it reaches the limit
        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`  💾 Committed batch of ${batchCount} Firestore deletions`);
          batch = adminDb.batch();
          batchCount = 0;
        }

        deletedCount++;
      } catch (error: any) {
        errors.push({
          uid,
          error: error.message
        });
        console.error(`  ❌ Error deleting user ${uid}:`, error.message);
      }
    }

    // Commit any remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  💾 Committed final batch of ${batchCount} Firestore deletions`);
    }

    console.log(`✅ Deletion complete: ${deletedCount} users deleted (${authDeletedCount} from Auth, ${firestoreDeletedCount} from Firestore)`);

    return NextResponse.json({
      success: true,
      data: {
        deleted_count: deletedCount,
        auth_deleted: authDeletedCount,
        firestore_deleted: firestoreDeletedCount,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Successfully deleted ${deletedCount} player user accounts (${authDeletedCount} from Auth, ${firestoreDeletedCount} from Firestore)`
    });
  } catch (error: any) {
    console.error('Error deleting users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete users' },
      { status: 500 }
    );
  }
}
