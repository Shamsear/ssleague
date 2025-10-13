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

async function updateUserRole(uid, newRole) {
  try {
    console.log(`🔄 Updating user role...`);
    console.log(`   UID: ${uid}`);
    console.log(`   New Role: ${newRole}\n`);
    
    // First, check if user exists
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found');
      return;
    }
    
    const currentData = userDoc.data();
    console.log(`Current user data:`);
    console.log(`   Username: ${currentData.username || 'N/A'}`);
    console.log(`   Email: ${currentData.email || 'N/A'}`);
    console.log(`   Current Role: ${currentData.role || 'undefined'}`);
    console.log('');
    
    // Update the user role
    await userRef.update({
      role: newRole,
      isActive: true,
      isApproved: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ User role updated successfully!');
    
    // Verify the update
    const updatedDoc = await userRef.get();
    const updatedData = updatedDoc.data();
    console.log(`\nVerification:`);
    console.log(`   New Role: ${updatedData.role}`);
    console.log(`   Active: ${updatedData.isActive}`);
    console.log(`   Approved: ${updatedData.isApproved}`);
    
  } catch (error) {
    console.error('❌ Error updating user role:', error);
  }
}

// Get command line arguments
const uid = process.argv[2];
const role = process.argv[3] || 'super_admin';

if (!uid) {
  console.log('❌ Please provide a user UID');
  console.log('Usage: node scripts/update-user-role.js <USER_UID> [ROLE]');
  console.log('Example: node scripts/update-user-role.js abc123 super_admin');
  process.exit(1);
}

updateUserRole(uid, role);