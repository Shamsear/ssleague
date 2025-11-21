const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  };
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function fixAllUserRoles() {
  try {
    console.log('🔍 Starting comprehensive user role fix...');
    console.log('📋 This will check all users and sync Firestore roles with Firebase Auth custom claims\n');
    
    let totalUsers = 0;
    let fixedUsers = 0;
    let skippedUsers = 0;
    let errorUsers = 0;
    const fixedUsersList = [];
    const errorUsersList = [];
    
    // Get all users from Firestore
    console.log('📖 Fetching all users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    
    console.log(`✅ Found ${usersSnapshot.size} users in Firestore\n`);
    
    for (const userDoc of usersSnapshot.docs) {
      totalUsers++;
      const uid = userDoc.id;
      const userData = userDoc.data();
      const firestoreRole = userData?.role;
      
      try {
        // Get Firebase Auth user
        const authUser = await auth.getUser(uid);
        const currentClaims = authUser.customClaims || {};
        const authRole = currentClaims.role;
        
        console.log(`👤 User: ${authUser.email || uid}`);
        console.log(`   - Firestore role: ${firestoreRole || 'MISSING'}`);
        console.log(`   - Auth claims role: ${authRole || 'MISSING'}`);
        
        // Check if roles are mismatched or missing
        const needsFix = !firestoreRole || !authRole || firestoreRole !== authRole;
        
        if (!needsFix) {
          console.log(`   ✅ Roles are synced correctly\n`);
          skippedUsers++;
          continue;
        }
        
        // Determine the correct role to use
        let correctRole = firestoreRole || authRole;
        
        // If no role exists anywhere, default to 'team'
        if (!correctRole) {
          correctRole = 'team';
          console.log(`   ⚠️  No role found, defaulting to 'team'`);
        }
        
        // Validate role
        const validRoles = ['team', 'committee_admin', 'super_admin'];
        if (!validRoles.includes(correctRole)) {
          console.log(`   ❌ Invalid role '${correctRole}', defaulting to 'team'`);
          correctRole = 'team';
        }
        
        console.log(`   🔧 Fixing role to: ${correctRole}`);
        
        // Update Firestore if needed
        if (firestoreRole !== correctRole) {
          await db.collection('users').doc(uid).update({
            role: correctRole,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`   📝 Firestore updated`);
        }
        
        // Update Auth claims if needed
        if (authRole !== correctRole) {
          await auth.setCustomUserClaims(uid, {
            ...currentClaims,
            role: correctRole,
          });
          console.log(`   🔑 Auth claims updated`);
        }
        
        fixedUsers++;
        fixedUsersList.push({
          email: authUser.email || uid,
          uid: uid,
          oldFirestoreRole: firestoreRole,
          oldAuthRole: authRole,
          newRole: correctRole
        });
        
        console.log(`   ✅ Role fix completed\n`);
        
      } catch (userError) {
        console.log(`   ❌ Error processing user: ${userError.message}\n`);
        errorUsers++;
        errorUsersList.push({
          uid: uid,
          error: userError.message,
          firestoreRole: firestoreRole
        });
      }
    }
    
    // Also check for Firebase Auth users not in Firestore
    console.log('🔍 Checking for Firebase Auth users missing from Firestore...');
    
    let authOnlyUsers = 0;
    let nextPageToken;
    
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      
      for (const authUser of listUsersResult.users) {
        const uid = authUser.uid;
        
        // Check if user exists in Firestore
        const firestoreDoc = await db.collection('users').doc(uid).get();
        
        if (!firestoreDoc.exists) {
          console.log(`👻 Auth-only user found: ${authUser.email || uid}`);
          
          try {
            // Create Firestore document with default role
            await db.collection('users').doc(uid).set({
              email: authUser.email,
              role: 'team', // Default role
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              isActive: true
            });
            
            // Set auth claims
            await auth.setCustomUserClaims(uid, {
              role: 'team'
            });
            
            console.log(`   ✅ Created Firestore document with 'team' role`);
            authOnlyUsers++;
            fixedUsers++;
            
          } catch (error) {
            console.log(`   ❌ Error creating Firestore document: ${error.message}`);
            errorUsers++;
          }
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    // Final summary
    console.log('\n🎉 Role fixing completed!');
    console.log('='.repeat(50));
    console.log(`📊 SUMMARY:`);
    console.log(`   Total users processed: ${totalUsers}`);
    console.log(`   Users fixed: ${fixedUsers}`);
    console.log(`   Users already correct: ${skippedUsers}`);
    console.log(`   Auth-only users fixed: ${authOnlyUsers}`);
    console.log(`   Errors: ${errorUsers}`);
    
    if (fixedUsersList.length > 0) {
      console.log(`\n✅ FIXED USERS:`);
      fixedUsersList.forEach(user => {
        console.log(`   - ${user.email}`);
        console.log(`     └── Role: ${user.oldFirestoreRole || 'missing'} → ${user.newRole}`);
      });
    }
    
    if (errorUsersList.length > 0) {
      console.log(`\n❌ ERRORS:`);
      errorUsersList.forEach(user => {
        console.log(`   - ${user.uid}: ${user.error}`);
      });
    }
    
    console.log(`\n🔄 Note: Users may need to log out and log back in for JWT token changes to take effect.`);
    
  } catch (error) {
    console.error('❌ Fatal error in role fixing:', error);
  }
}

fixAllUserRoles();