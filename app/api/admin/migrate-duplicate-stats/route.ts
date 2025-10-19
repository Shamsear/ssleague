import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting migration to remove duplicate stats fields...');

    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check user role
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    if (userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }

    console.log('✅ Super admin access confirmed');

    // Fetch all realplayerstats documents
    const statsSnapshot = await adminDb.collection('realplayerstats').get();
    
    console.log(`📊 Found ${statsSnapshot.size} player stats documents to check`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    let currentBatch = adminDb.batch();
    let batchCount = 0;

    for (const doc of statsSnapshot.docs) {
      try {
        const data = doc.data();
        
        // Check if document has the nested 'stats' field
        if (data.stats && typeof data.stats === 'object') {
          console.log(`  🔄 Removing nested stats from: ${data.player_name || doc.id}`);
          
          // Remove the nested 'stats' field
          currentBatch.update(doc.ref, {
            stats: FieldValue.delete()
          });
          
          batchCount++;
          updatedCount++;

          // Commit batch if we've reached the limit
          if (batchCount >= batchSize) {
            await currentBatch.commit();
            console.log(`  ✅ Committed batch of ${batchCount} updates`);
            currentBatch = adminDb.batch();
            batchCount = 0;
          }
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing document ${doc.id}:`, error.message);
        errorCount++;
        errors.push(`Error processing ${doc.id}: ${error.message}`);
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await currentBatch.commit();
      console.log(`  ✅ Committed final batch of ${batchCount} updates`);
    }

    console.log('✅ Migration completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      stats: {
        total: statsSnapshot.size,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        errorDetails: errors
      }
    });

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error.message
    }, { status: 500 });
  }
}
