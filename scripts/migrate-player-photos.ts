// Load environment variables BEFORE importing admin
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first
config({ path: resolve(process.cwd(), '.env.local') });

// Now import Firebase admin
import { adminDb } from '../lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Player IDs that registered with photos
const PLAYER_IDS = [
  'sspslpsl0007', // Umar
  'sspslpsl0005', // Goku
  'sspslpsl0055', // Karthik
  'sspslpsl0097', // Nishal
  'sspslpsl0084', // Abu
];

// ImageKit configuration - you'll need to set your URL endpoint
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/YOUR_IMAGEKIT_ID';

// Common image extensions
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/**
 * Check if a URL exists by making a HEAD request
 */
async function urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Find the correct image extension for a player photo
 */
async function findPlayerPhotoUrl(playerId: string): Promise<string | null> {
  for (const ext of IMAGE_EXTENSIONS) {
    const url = `${IMAGEKIT_URL_ENDPOINT}/player-photos/${playerId}.${ext}`;
    console.log(`  Checking: ${url}`);
    
    if (await urlExists(url)) {
      console.log(`  ✅ Found: ${url}`);
      return url;
    }
  }
  
  return null;
}

/**
 * Update player document with photo URL
 */
async function updatePlayerPhoto(playerId: string, photoUrl: string): Promise<boolean> {
  try {
    // Query for player document by player_id field
    const playersSnapshot = await adminDb
      .collection('realplayers')
      .where('player_id', '==', playerId)
      .limit(1)
      .get();
    
    if (playersSnapshot.empty) {
      console.log(`  ❌ Player document not found for ${playerId}`);
      return false;
    }
    
    const playerDoc = playersSnapshot.docs[0];
    
    // Extract fileId from URL
    // URL format: https://ik.imagekit.io/xxx/player-photos/sspslpsl0007.jpg
    const matches = photoUrl.match(/player-photos\/([^/]+)$/);
    const photoFileId = matches ? matches[1] : null;
    
    await playerDoc.ref.update({
      photo_url: photoUrl,
      photo_file_id: photoFileId,
      updated_at: FieldValue.serverTimestamp(),
    });
    
    console.log(`  ✅ Updated ${playerId} with photo URL`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error updating ${playerId}:`, error);
    return false;
  }
}

/**
 * Main migration function
 */
async function migratePlayerPhotos() {
  console.log('🚀 Starting player photo migration...\n');
  console.log(`ImageKit URL Endpoint: ${IMAGEKIT_URL_ENDPOINT}\n`);
  
  let successCount = 0;
  let failedCount = 0;
  
  for (const playerId of PLAYER_IDS) {
    console.log(`\n📸 Processing ${playerId}...`);
    
    // Find the photo URL
    const photoUrl = await findPlayerPhotoUrl(playerId);
    
    if (!photoUrl) {
      console.log(`  ⚠️  No photo found in ImageKit for ${playerId}`);
      failedCount++;
      continue;
    }
    
    // Update Firestore document
    const success = await updatePlayerPhoto(playerId, photoUrl);
    
    if (success) {
      successCount++;
    } else {
      failedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failedCount}`);
  console.log(`  📋 Total: ${PLAYER_IDS.length}`);
  console.log('='.repeat(60));
}

// Run migration
migratePlayerPhotos()
  .then(() => {
    console.log('\n✅ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
