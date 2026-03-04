/**
 * Fix committee admin users by adding seasonId custom claim
 * 
 * This script finds all committee_admin users and sets their seasonId custom claim
 * based on their Firestore user document.
 * 
 * Run: node scripts/fix-committee-admin-season.js
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function fixCommitteeAdminSeasons() {
  console.log('🔄 Starting committee admin season fix...\n');
  
  try {
    // Get all committee admin users from Firestore
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'committee_admin')
      .get();
    
    console.log(`📊 Found ${usersSnapshot.size} committee admin users\n`);
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No committee admin users found!');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    
    // Process each committee admin
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const seasonId = userData.seasonId || userData.season_id;
      const email = userData.email || 'unknown';
      
      console.log(`\n👤 Processing: ${email} (${userId})`);
      
      if (!seasonId) {
        console.log(`   ⚠️  No seasonId found in Firestore document`);
        console.log(`   💡 Please set seasonId field in Firestore for this user`);
        skipCount++;
        continue;
      }
      
      try {
        // Get current custom claims
        const user = await auth.getUser(userId);
        const currentClaims = user.customClaims || {};
        
        // Check if already set correctly
        if (currentClaims.role === 'committee_admin' && currentClaims.seasonId === seasonId) {
          console.log(`   ✓ Already configured correctly`);
          console.log(`   - Role: committee_admin`);
          console.log(`   - Season: ${seasonId}`);
          skipCount++;
          continue;
        }
        
        // Set custom claims with both role and seasonId
        await auth.setCustomUserClaims(userId, {
          ...currentClaims,
          role: 'committee_admin',
          seasonId: seasonId,
        });
        
        console.log(`   ✅ Updated successfully!`);
        console.log(`   - Role: committee_admin`);
        console.log(`   - Season: ${seasonId}`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${usersSnapshot.size}`);
    console.log('='.repeat(60));
    
    if (successCount > 0) {
      console.log('\n✨ Done! Committee admins now have seasonId in their custom claims.');
      console.log('💡 Note: Users need to refresh their tokens (re-login) to get the new claims.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
fixCommitteeAdminSeasons()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
