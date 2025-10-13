/**
 * Cleanup Duplicate Player Stats
 * 
 * This script finds and removes duplicate entries in the realplayerstats collection.
 * A duplicate is defined as multiple documents with the same player_id and season_id combination.
 * 
 * The script will:
 * 1. Find all documents in realplayerstats
 * 2. Group by player_id + season_id
 * 3. For duplicates, keep the most recently updated and delete the rest
 * 
 * Usage: node scripts/cleanup-duplicate-player-stats.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin (same as main project)
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      // Using service account credentials from environment
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized with service account\n');
    } else if (projectId) {
      // Using project ID only
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
    } else {
      // Try default application credentials
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function findDuplicates() {
  console.log('🔍 Scanning realplayerstats collection for duplicates...\n');
  
  const snapshot = await db.collection('realplayerstats').get();
  console.log(`📊 Found ${snapshot.size} total documents\n`);
  
  // Group documents by player_id + season_id
  const groups = new Map();
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const key = `${data.player_id}-${data.season_id}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    
    groups.get(key).push({
      id: doc.id,
      player_id: data.player_id,
      player_name: data.player_name || data.name,
      season_id: data.season_id,
      updated_at: data.updated_at?.toDate?.() || new Date(0),
      created_at: data.created_at?.toDate?.() || new Date(0)
    });
  });
  
  // Find duplicates (groups with more than one document)
  const duplicates = [];
  groups.forEach((docs, key) => {
    if (docs.length > 1) {
      // Sort by updated_at descending (most recent first)
      docs.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
      duplicates.push({ key, docs });
    }
  });
  
  return duplicates;
}

async function cleanupDuplicates(dryRun = true) {
  const duplicates = await findDuplicates();
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicates found! Database is clean.\n');
    return;
  }
  
  console.log(`⚠️  Found ${duplicates.length} duplicate player-season combinations:\n`);
  
  let totalToDelete = 0;
  const batch = db.batch();
  
  duplicates.forEach(({ key, docs }) => {
    const [player_id, season_id] = key.split('-');
    const [keep, ...toDelete] = docs;
    
    console.log(`🔄 Player ${keep.player_name} (${player_id}) in Season ${season_id}:`);
    console.log(`   ✅ KEEP: ${keep.id} (updated: ${keep.updated_at.toISOString()})`);
    
    toDelete.forEach(doc => {
      console.log(`   ❌ DELETE: ${doc.id} (updated: ${doc.updated_at.toISOString()})`);
      totalToDelete++;
      
      if (!dryRun) {
        batch.delete(db.collection('realplayerstats').doc(doc.id));
      }
    });
    
    console.log('');
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   - Duplicate groups found: ${duplicates.length}`);
  console.log(`   - Documents to delete: ${totalToDelete}`);
  console.log(`   - Documents to keep: ${duplicates.length}\n`);
  
  if (dryRun) {
    console.log('🔷 DRY RUN MODE - No changes made');
    console.log('   Run with --execute flag to perform actual deletion\n');
  } else {
    console.log('⚠️  EXECUTING DELETION...');
    await batch.commit();
    console.log('✅ Cleanup completed successfully!\n');
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

if (!dryRun) {
  console.log('⚠️  WARNING: Running in EXECUTE mode. This will permanently delete duplicate records.\n');
}

cleanupDuplicates(dryRun)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
