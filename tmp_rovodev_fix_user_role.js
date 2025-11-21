const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function fixUserRole() {
  try {
    // You can modify these values:
    const userEmail = process.argv[2]; // First argument: email
    const newRole = process.argv[3];   // Second argument: role
    
    if (!userEmail || !newRole) {
      console.log('❌ Usage: node tmp_rovodev_fix_user_role.js <email> <role>');
      console.log('❌ Example: node tmp_rovodev_fix_user_role.js user@example.com team');
      console.log('❌ Valid roles: team, committee_admin, super_admin');
      process.exit(1);
    }
    
    // Validate role
    const validRoles = ['team', 'committee_admin', 'super_admin'];
    if (!validRoles.includes(newRole)) {
      console.log(`❌ Invalid role. Must be one of: ${validRoles.join(', ')}`);
      process.exit(1);
    }
    
    console.log(`🔍 Looking for user: ${userEmail}`);
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(userEmail);
    const uid = userRecord.uid;
    
    console.log(`✅ Found user: ${uid}`);
    console.log(`📝 Current custom claims:`, userRecord.customClaims || 'None');
    
    // Step 1: Update Firestore database
    console.log(`📝 Updating Firestore user document...`);
    await db.collection('users').doc(uid).update({
      role: newRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Firestore role updated to: ${newRole}`);
    
    // Step 2: Set custom claims (JWT token)
    console.log(`🔑 Setting Firebase Auth custom claims...`);
    const currentClaims = userRecord.customClaims || {};
    await auth.setCustomUserClaims(uid, {
      ...currentClaims,
      role: newRole,
    });
    console.log(`✅ Custom claims set: role=${newRole}`);
    
    // Verify the changes
    const updatedUser = await auth.getUser(uid);
    console.log(`🔍 Verification - New custom claims:`, updatedUser.customClaims);
    
    // Check Firestore document
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    console.log(`🔍 Verification - Firestore role:`, userData?.role);
    
    console.log(`🎉 Role fix completed successfully!`);
    console.log(`📋 Summary:`);
    console.log(`   - User: ${userEmail} (${uid})`);
    console.log(`   - New Role: ${newRole}`);
    console.log(`   - JWT Claims: Updated ✅`);
    console.log(`   - Firestore: Updated ✅`);
    
  } catch (error) {
    console.error('❌ Error fixing user role:', error.message);
    console.error('Full error:', error);
  }
}

fixUserRole();