/**
 * ONE-TIME SETUP: Set custom claims for all existing Firebase users
 * 
 * This script reads user roles from Firestore and sets them as custom claims in JWT tokens.
 * After running this once, all future JWT tokens will contain the role (zero DB reads!)
 * 
 * Run: node scripts/set-user-custom-claims.js
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

async function setCustomClaimsForAllUsers() {
  console.log('🔄 Starting custom claims migration...\n');
  
  try {
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`📊 Found ${usersSnapshot.size} users in Firestore\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    
    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const role = userData.role;
      
      if (!role) {
        console.log(`⏭️  Skipping ${userId} - no role defined`);
        skipCount++;
        continue;
      }
      
      try {
        // Get current custom claims
        const user = await auth.getUser(userId);
        const currentClaims = user.customClaims || {};
        
        // Only update if role has changed
        if (currentClaims.role === role) {
          console.log(`✓ ${userId} - already has role: ${role}`);
          skipCount++;
          continue;
        }
        
        // Set custom claim
        await auth.setCustomUserClaims(userId, {
          ...currentClaims,
          role: role,
        });
        
        console.log(`✅ ${userId} - set role: ${role}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error setting claims for ${userId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${usersSnapshot.size}`);
    
    console.log('\n✨ Done! All users now have custom claims.');
    console.log('💡 Note: Users need to refresh their tokens (re-login) to get the new claims.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
setCustomClaimsForAllUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
