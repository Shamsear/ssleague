/**
 * Fix Missing Season IDs in realplayerstats
 * 
 * This script finds all realplayerstats documents that are missing season_id
 * and attempts to infer/add it based on the document's id field or other context.
 * 
 * Usage: node scripts/fix-missing-season-ids.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized with service account\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

const db = admin.firestore();

async function fixMissingSeasonIds(dryRun = false) {
  console.log('🚀 Starting fix for missing season_id in realplayerstats...\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be saved)'}\n`);
  
  try {
    // Get all realplayerstats documents
    const snapshot = await db.collection('realplayerstats').get();
    
    if (snapshot.empty) {
      console.log('❌ No documents found in realplayerstats collection');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} documents to check\n`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let documentsWithoutSeasonId = [];
    
    // First pass: identify documents without season_id
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.season_id || data.season_id === null || data.season_id === undefined) {
        documentsWithoutSeasonId.push({
          docId: doc.id,
          data: data
        });
      } else {
        skippedCount++;
      }
    });
    
    console.log(`📋 Documents missing season_id: ${documentsWithoutSeasonId.length}`);
    console.log(`✅ Documents already have season_id: ${skippedCount}\n`);
    
    if (documentsWithoutSeasonId.length === 0) {
      console.log('🎉 All documents already have season_id!');
      return;
    }
    
    // Get all seasons to help match documents
    const seasonsSnapshot = await db.collection('seasons').get();
    const seasons = [];
    seasonsSnapshot.forEach(doc => {
      seasons.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`📅 Found ${seasons.length} seasons in database\n`);
    
    // Second pass: fix documents
    const batch = db.batch();
    let batchCount = 0;
    
    for (const { docId, data } of documentsWithoutSeasonId) {
      try {
        console.log(`Processing document: ${docId}`);
        console.log(`  Player: ${data.player_name || data.player_id || 'Unknown'}`);
        console.log(`  Document id field: ${data.id || 'None'}`);
        
        let inferredSeasonId = null;
        
        // Strategy 1: Check if the 'id' field contains a season pattern
        // Format is typically: {season_id}{player_id}{league_id}{extra}
        // Example: sspslpsl0102 might be: ss (season) psl (league) psl (player prefix) 0102 (player num)
        if (data.id && typeof data.id === 'string') {
          // Try to match against known season IDs
          for (const season of seasons) {
            if (data.id.startsWith(season.id)) {
              inferredSeasonId = season.id;
              console.log(`  ✅ Inferred season_id from id field: ${inferredSeasonId}`);
              break;
            }
          }
        }
        
        // Strategy 2: If only one season exists, use it
        if (!inferredSeasonId && seasons.length === 1) {
          inferredSeasonId = seasons[0].id;
          console.log(`  ℹ️  Using only available season: ${inferredSeasonId}`);
        }
        
        // Strategy 3: Prompt for manual mapping (for interactive mode)
        // For now, we'll leave these for manual review
        if (!inferredSeasonId) {
          console.log(`  ⚠️  Cannot automatically infer season_id`);
          console.log(`  📝 Available seasons:`);
          seasons.forEach((s, idx) => {
            console.log(`     ${idx + 1}. ${s.id} - ${s.name || s.short_name || 'Unnamed'}`);
          });
          console.log(`  ❌ Skipping - requires manual intervention\n`);
          errorCount++;
          continue;
        }
        
        if (!dryRun) {
          // Update the document
          const docRef = db.collection('realplayerstats').doc(docId);
          batch.update(docRef, {
            season_id: inferredSeasonId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
          batchCount++;
          
          // Commit batch every 400 operations (Firestore limit is 500)
          if (batchCount >= 400) {
            console.log(`\n💾 Committing batch of ${batchCount} operations...`);
            await batch.commit();
            batchCount = 0;
          }
        }
        
        fixedCount++;
        console.log(`  ✅ ${dryRun ? 'Would update' : 'Updated'} with season_id: ${inferredSeasonId}\n`);
        
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error processing document ${docId}:`, error.message);
        console.log('');
      }
    }
    
    // Commit remaining operations
    if (!dryRun && batchCount > 0) {
      console.log(`\n💾 Committing final batch of ${batchCount} operations...`);
      await batch.commit();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Fix completed! ${dryRun ? '(DRY RUN - no changes made)' : ''}`);
    console.log('='.repeat(60));
    console.log(`📊 Documents ${dryRun ? 'that would be' : ''} fixed: ${fixedCount}`);
    console.log(`⏭️  Documents skipped (already have season_id): ${skippedCount}`);
    console.log(`❌ Documents requiring manual intervention: ${errorCount}`);
    
    if (dryRun) {
      console.log('\n💡 Run without --dry-run to apply changes');
    } else if (errorCount > 0) {
      console.log('\n⚠️  Some documents could not be automatically fixed.');
      console.log('   You may need to manually set season_id for these documents.');
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run fix
fixMissingSeasonIds(dryRun)
  .then(() => {
    console.log('🎉 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
