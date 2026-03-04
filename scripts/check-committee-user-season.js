const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function checkCommitteeUserSeason() {
  try {
    // Get the current user's email (you'll need to replace this)
    const userEmail = process.env.COMMITTEE_USER_EMAIL || 'committee@example.com';
    
    console.log(`\n🔍 Checking season assignment for: ${userEmail}\n`);
    
    // Get user by email
    const user = await admin.auth().getUserByEmail(userEmail);
    
    console.log('User ID:', user.uid);
    console.log('Display Name:', user.displayName);
    console.log('Email:', user.email);
    
    // Get custom claims
    const customClaims = user.customClaims || {};
    console.log('\n📋 Custom Claims:');
    console.log(JSON.stringify(customClaims, null, 2));
    
    if (customClaims.seasonId) {
      console.log(`\n✅ User is assigned to season: ${customClaims.seasonId}`);
    } else {
      console.log('\n⚠️  User has NO seasonId in custom claims!');
    }
    
    if (customClaims.role) {
      console.log(`Role: ${customClaims.role}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // List all committee admin users
    console.log('\n📋 Listing all committee admin users...\n');
    
    const listUsers = await admin.auth().listUsers(1000);
    const committeeUsers = listUsers.users.filter(user => 
      user.customClaims?.role === 'committee_admin'
    );
    
    console.log(`Found ${committeeUsers.length} committee admin users:\n`);
    committeeUsers.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email}`);
      console.log(`   Season: ${user.customClaims?.seasonId || 'NOT SET'}`);
      console.log(`   UID: ${user.uid}\n`);
    });
  }
}

checkCommitteeUserSeason();
