/**
 * Migration Script: Copy team logos from users collection to teams collection
 * 
 * This script:
 * 1. Fetches all users with role='team' that have a logoUrl
 * 2. Finds corresponding team documents
 * 3. Updates teams collection with logo_url from users.logoUrl
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin SDK
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
      console.log('Firebase Admin initialized with service account');
    } else if (projectId) {
      // Option 2: Using project ID only (for development)
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`Firebase Admin initialized with project ID: ${projectId}`);
    } else {
      // Option 3: Try default application credentials
      admin.initializeApp();
      console.log('Firebase Admin initialized with default credentials');
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

const db = admin.firestore();

async function migrateTeamLogos() {
  console.log('🚀 Starting team logo migration...\n');
  
  try {
    // Step 1: Fetch all team users with logos
    console.log('📋 Step 1: Fetching team users...');
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'team')
      .get();
    
    console.log(`Found ${usersSnapshot.size} team users\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Step 2: Process each team user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const logoUrl = userData.logoUrl;
      const teamName = userData.teamName || userData.username || 'Unknown';
      const teamId = userData.teamId; // Get the team ID from user data
      
      // Skip if no logo
      if (!logoUrl) {
        console.log(`⏭️  Skipping ${teamName} (User: ${userId}) - No logo`);
        skippedCount++;
        continue;
      }
      
      // Skip if no team ID
      if (!teamId) {
        console.log(`⚠️  Skipping ${teamName} (User: ${userId}) - No team ID in user document`);
        skippedCount++;
        continue;
      }
      
      try {
        // Check if team document exists using team ID
        const teamDoc = await db.collection('teams').doc(teamId).get();
        
        if (!teamDoc.exists) {
          console.log(`⚠️  Team document not found for ${teamName} (Team ID: ${teamId}) - Skipping`);
          skippedCount++;
          continue;
        }
        
        const teamData = teamDoc.data();
        
        // Check if logo_url already exists and is the same
        if (teamData && teamData.logo_url === logoUrl) {
          console.log(`✓ ${teamName} (${userId}) - Logo already up to date`);
          skippedCount++;
          continue;
        }
        
        // Update team document with logo
        await db.collection('teams').doc(teamId).update({
          logo_url: logoUrl,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Updated ${teamName}`);
        console.log(`   Team ID: ${teamId}`);
        console.log(`   User ID: ${userId}`);
        console.log(`   Logo: ${logoUrl.substring(0, 60)}...`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error updating ${teamName} (Team ID: ${teamId}, User ID: ${userId}):`, error.message);
        errors.push({ userId, teamId, error: error.message });
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
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
migrateTeamLogos();
