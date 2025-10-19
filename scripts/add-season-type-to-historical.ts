/**
 * Migration Script: Add Season Type to Historical Seasons
 * 
 * Adds 'type: single' to all existing seasons (1-15) that don't have a type field.
 * This ensures backward compatibility while introducing multi-season support.
 * 
 * Usage:
 * npm run tsx scripts/add-season-type-to-historical.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin (only if not already initialized)
if (getApps().length === 0) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized with environment credentials\n');
  } else {
    console.error('❌ Error: Firebase Admin credentials not found in environment!');
    console.error('Please set: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }
}

const db = getFirestore();

async function addSeasonTypeToHistorical() {
  console.log('🚀 Starting migration: Add season type to historical seasons\n');
  
  try {
    // Get all seasons
    const seasonsRef = db.collection('seasons');
    const snapshot = await seasonsRef.get();
    
    if (snapshot.empty) {
      console.log('❌ No seasons found in database');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} seasons\n`);
    
    // Track updates
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    const batch = db.batch();
    
    // Process each season
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const seasonName = data.name || doc.id;
      
      // Skip if already has type field
      if (data.type) {
        console.log(`⏭️  Skipped: ${seasonName} (already has type: ${data.type})`);
        skipped++;
        continue;
      }
      
      try {
        // Add type: 'single' to seasons without type
        batch.update(doc.ref, { 
          type: 'single',
          updatedAt: new Date()
        });
        
        console.log(`✅ Queued: ${seasonName} → type: 'single'`);
        updated++;
        
      } catch (error) {
        console.error(`❌ Error processing ${seasonName}:`, error);
        errors++;
      }
    }
    
    // Commit batch
    if (updated > 0) {
      console.log(`\n📝 Committing batch update for ${updated} seasons...`);
      await batch.commit();
      console.log('✅ Batch committed successfully\n');
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Updated:  ${updated} seasons`);
    console.log(`⏭️  Skipped:  ${skipped} seasons`);
    console.log(`❌ Errors:   ${errors} seasons`);
    console.log(`📈 Total:    ${snapshot.size} seasons`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (updated > 0) {
      console.log('✅ Migration completed successfully!');
      console.log('💡 All historical seasons now have type: "single"');
      console.log('💡 New seasons can be created with type: "multi" for Season 16+\n');
    } else {
      console.log('ℹ️  No seasons needed updating\n');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
addSeasonTypeToHistorical()
  .then(() => {
    console.log('🎉 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
