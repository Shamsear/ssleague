/**
 * Migration Script: Copy team logos from users collection to teams collection
 * 
 * This script:
 * 1. Fetches all users with role='team' that have a logoUrl
 * 2. Finds corresponding team documents
 * 3. Updates teams collection with logo_url from users.logoUrl
 */

// Load environment variables BEFORE importing admin
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first
config({ path: resolve(process.cwd(), '.env.local') });

// Now import Firebase admin
import { adminDb } from '../lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

async function migrateTeamLogos() {
  console.log('🚀 Starting team logo migration...\n');
  
  try {
    // Step 1: Fetch all team users with logos
    console.log('📋 Step 1: Fetching team users with logos...');
    const usersSnapshot = await adminDb.collection('users')
      .where('role', '==', 'team')
      .get();
    
    console.log(`Found ${usersSnapshot.size} team users\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];
    
    // Step 2: Process each team user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const logoUrl = userData.logoUrl;
      const teamName = userData.teamName || userData.username || 'Unknown';
      
      // Skip if no logo
      if (!logoUrl) {
        console.log(`⏭️  Skipping ${teamName} (${userId}) - No logo`);
        skippedCount++;
        continue;
      }
      
      try {
        // Check if team document exists
        const teamDoc = await adminDb.collection('teams').doc(userId).get();
        
        if (!teamDoc.exists) {
          console.log(`⚠️  Team document not found for ${teamName} (${userId}) - Skipping`);
          skippedCount++;
          continue;
        }
        
        const teamData = teamDoc.data();
        
        // Check if logo_url already exists and is the same
        if (teamData?.logo_url === logoUrl) {
          console.log(`✓ ${teamName} (${userId}) - Logo already up to date`);
          skippedCount++;
          continue;
        }
        
        // Update team document with logo
        await adminDb.collection('teams').doc(userId).update({
          logo_url: logoUrl,
          updated_at: FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Updated ${teamName} (${userId})`);
        console.log(`   Logo: ${logoUrl.substring(0, 60)}...`);
        updatedCount++;
        
      } catch (error: any) {
        console.error(`❌ Error updating ${teamName} (${userId}):`, error.message);
        errors.push({ userId, error: error.message });
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`⏭️  Skipped (no change needed): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total processed: ${usersSnapshot.size}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(({ userId, error }) => {
        console.log(`   - ${userId}: ${error}`);
      });
    }
    
    console.log('\n✨ Migration completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
migrateTeamLogos()
  .then(() => {
    console.log('\n👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
