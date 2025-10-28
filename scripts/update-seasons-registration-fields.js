/**
 * Script to update existing seasons with registration phase fields
 * Run with: node scripts/update-seasons-registration-fields.js
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      // Option 1: Using service account credentials (recommended for production)
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
    process.exit(1);
  }
}

const adminDb = admin.firestore();

async function updateSeasons() {
  try {
    console.log('🔄 Starting season registration fields update...\n');

    const seasonsSnapshot = await adminDb.collection('seasons').get();
    
    if (seasonsSnapshot.empty) {
      console.log('⚠️ No seasons found in database');
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const doc of seasonsSnapshot.docs) {
      const seasonData = doc.data();
      const seasonId = doc.id;

      // Check if fields already exist
      if (seasonData.registration_phase !== undefined) {
        console.log(`⏭️  Skipping ${seasonId} - already has registration fields`);
        skipped++;
        continue;
      }

      // Update with default values
      await doc.ref.update({
        registration_phase: 'confirmed',
        confirmed_slots_limit: 100, // Default limit
        confirmed_slots_filled: 0,
        unconfirmed_registration_enabled: false,
        updated_at: new Date(),
      });

      console.log(`✅ Updated ${seasonId} (${seasonData.name}) with registration fields`);
      updated++;
    }

    console.log(`\n✨ Update complete!`);
    console.log(`   Updated: ${updated} seasons`);
    console.log(`   Skipped: ${skipped} seasons`);
  } catch (error) {
    console.error('❌ Error updating seasons:', error);
    throw error;
  }
}

updateSeasons()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
