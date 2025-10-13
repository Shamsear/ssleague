/**
 * Migration Script: Clean up realplayers collection
 * 
 * This script removes all season-specific fields from realplayers documents,
 * keeping only permanent player information.
 * 
 * After running this script, you should re-import historical seasons to 
 * populate the realplayerstats collection.
 * 
 * Usage: node scripts/migrate-realplayers.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      // Option 1: Using service account credentials (recommended)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized with service account\n');
    } else if (projectId) {
      // Option 2: Using project ID only (for development)
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
    } else {
      // Option 3: Try default application credentials
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

const db = admin.firestore();

// Fields to KEEP (permanent player information)
const PERMANENT_FIELDS = [
  'player_id',
  'name',
  'display_name',
  'email',
  'phone',
  'role',
  'psn_id',
  'xbox_id',
  'steam_id',
  'is_registered',
  'is_active',
  'is_available',
  'notes',
  'profile_image',
  'created_at',
  'updated_at',
  'joined_date',
  'registered_at',
  'assigned_by'
];

// Fields to REMOVE (season-specific)
const FIELDS_TO_REMOVE = [
  'category',
  'category_id',
  'team',
  'team_id',
  'season_id',
  'season_name',
  'stats',
  'round_performance',
  'potm_awards',
  'is_potm',
  'ranking',
  'played',
  'points',
  'goals_scored',
  'clean_sheets'
];

async function migrateRealPlayers() {
  console.log('🚀 Starting migration of realplayers collection...\n');
  
  try {
    // Get all documents from realplayers collection
    const snapshot = await db.collection('realplayers').get();
    
    if (snapshot.empty) {
      console.log('❌ No documents found in realplayers collection');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} documents to process\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const playerId = data.player_id || doc.id;
        
        console.log(`Processing: ${data.name || 'Unknown'} (${playerId})`);
        
        // Build the update object with only permanent fields
        const updateData = {};
        
        // Copy permanent fields
        PERMANENT_FIELDS.forEach(field => {
          if (data[field] !== undefined) {
            updateData[field] = data[field];
          }
        });
        
        // Build object to delete season-specific fields
        const deleteFields = {};
        FIELDS_TO_REMOVE.forEach(field => {
          if (data[field] !== undefined) {
            deleteFields[field] = admin.firestore.FieldValue.delete();
            console.log(`  🗑️  Removing: ${field}`);
          }
        });
        
        // Add timestamp
        deleteFields.updated_at = admin.firestore.FieldValue.serverTimestamp();
        
        // Check if using player_id as document ID or auto-generated ID
        let targetDocId = playerId;
        
        // If document ID is not the same as player_id, we need to handle differently
        if (doc.id !== playerId) {
          console.log(`  ⚠️  Document ID (${doc.id}) differs from player_id (${playerId})`);
          
          // Check if a document with player_id already exists
          const correctDoc = await db.collection('realplayers').doc(playerId).get();
          
          if (correctDoc.exists && correctDoc.id !== doc.id) {
            // A document with correct ID exists, delete this one
            console.log(`  ❌ Deleting duplicate document with ID: ${doc.id}`);
            batch.delete(doc.ref);
            batchCount++;
            continue;
          } else {
            // Use the correct player_id as target
            targetDocId = playerId;
          }
        }
        
        // Update the document
        const targetRef = db.collection('realplayers').doc(targetDocId);
        batch.set(targetRef, { ...updateData, ...deleteFields }, { merge: true });
        
        // Delete the old document if IDs don't match
        if (doc.id !== targetDocId) {
          batch.delete(doc.ref);
          console.log(`  📝 Creating new document with ID: ${targetDocId}`);
          console.log(`  🗑️  Deleting old document with ID: ${doc.id}`);
        }
        
        batchCount++;
        processedCount++;
        
        // Commit batch every 400 operations (Firestore limit is 500)
        if (batchCount >= 400) {
          console.log(`\n💾 Committing batch of ${batchCount} operations...`);
          await batch.commit();
          batchCount = 0;
        }
        
        console.log(`  ✅ Processed successfully\n`);
        
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error processing document ${doc.id}:`, error.message);
        console.log('');
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      console.log(`\n💾 Committing final batch of ${batchCount} operations...`);
      await batch.commit();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed!');
    console.log('='.repeat(60));
    console.log(`📊 Total documents processed: ${processedCount}`);
    console.log(`❌ Errors encountered: ${errorCount}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Re-import historical seasons to populate realplayerstats collection');
    console.log('   2. Verify player data in the UI');
    console.log('   3. Check that all season-specific data is removed from realplayers\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateRealPlayers()
  .then(() => {
    console.log('🎉 Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
