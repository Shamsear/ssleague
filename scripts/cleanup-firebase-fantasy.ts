/**
 * Cleanup Script: Delete All Fantasy Data from Firebase
 * 
 * This script removes all fantasy-related collections from Firebase
 * since the fantasy system has been migrated to PostgreSQL (Neon).
 * 
 * Collections to delete:
 * - fantasy_leagues
 * - fantasy_teams
 * - fantasy_drafts
 * - fantasy_squad
 * - fantasy_player_points
 * - fantasy_scoring_rules
 * - fantasy_transfers
 * - fantasy_player_prices
 * 
 * Usage: npx tsx scripts/cleanup-firebase-fantasy.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// Collections to delete
const FANTASY_COLLECTIONS = [
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

async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = db.collection(collectionName);
  const batchSize = 500;
  let totalDeleted = 0;

  console.log(`\n🔍 Processing collection: ${collectionName}`);

  try {
    let snapshot = await collectionRef.limit(batchSize).get();

    while (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;
      console.log(`   ✅ Deleted ${snapshot.size} documents (total: ${totalDeleted})`);

      // Fetch next batch
      snapshot = await collectionRef.limit(batchSize).get();
    }

    console.log(`✅ Completed: ${collectionName} - ${totalDeleted} documents deleted`);
    return totalDeleted;
  } catch (error) {
    console.error(`❌ Error deleting ${collectionName}:`, error);
    return totalDeleted;
  }
}

async function cleanupFantasyData() {
  console.log('🧹 Starting Firebase Fantasy Data Cleanup');
  console.log('=' .repeat(60));
  console.log('This will permanently delete all fantasy-related data from Firebase.');
  console.log('The fantasy system now uses PostgreSQL exclusively.');
  console.log('=' .repeat(60));

  const stats: Record<string, number> = {};
  let grandTotal = 0;

  for (const collectionName of FANTASY_COLLECTIONS) {
    const deleted = await deleteCollection(collectionName);
    stats[collectionName] = deleted;
    grandTotal += deleted;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Cleanup Summary:');
  console.log('='.repeat(60));
  
  Object.entries(stats).forEach(([collection, count]) => {
    console.log(`   ${collection.padEnd(30)} : ${count} documents`);
  });
  
  console.log('='.repeat(60));
  console.log(`🎉 Total documents deleted: ${grandTotal}`);
  console.log('✅ Firebase fantasy data cleanup complete!');
  console.log('💾 All fantasy data is now exclusively in PostgreSQL (Neon).');
}

// Run the cleanup
cleanupFantasyData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
