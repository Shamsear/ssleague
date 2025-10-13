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

async function checkUserRole() {
  try {
    console.log('🔍 Checking user roles in the database...\n');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No users found in the database');
      return;
    }
    
    console.log(`Found ${usersSnapshot.size} users:\n`);
    
    let foundSuperAdmin = false;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const status = userData.isActive ? '✅ Active' : '❌ Inactive';
      const approved = userData.isApproved ? '✅ Approved' : '❌ Pending';
      
      console.log(`👤 User: ${userData.username || userData.email}`);
      console.log(`   UID: ${doc.id}`);
      console.log(`   Role: ${userData.role || 'undefined'}`);
      console.log(`   Status: ${status}`);
      console.log(`   Approved: ${approved}`);
      console.log('');
      
      if (userData.role === 'super_admin') {
        foundSuperAdmin = true;
      }
    });
    
    if (!foundSuperAdmin) {
      console.log('⚠️  No super_admin users found!');
      console.log('');
      
      // Get the first user and offer to make them super admin
      const firstUserDoc = usersSnapshot.docs[0];
      const firstUserData = firstUserDoc.data();
      
      console.log(`Would you like to make user "${firstUserData.username || firstUserData.email}" a super admin?`);
      console.log(`User UID: ${firstUserDoc.id}`);
      console.log('');
      console.log('To update manually, run:');
      console.log(`node scripts/update-user-role.js ${firstUserDoc.id} super_admin`);
      
    } else {
      console.log('✅ Super admin users found!');
    }
    
  } catch (error) {
    console.error('❌ Error checking user roles:', error);
  }
}

checkUserRole();