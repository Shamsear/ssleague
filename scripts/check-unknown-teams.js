const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function checkUnknownTeams() {
  console.log('🔍 Checking for teams with "Unknown Team" name...\n');

  try {
    const teamsSnapshot = await db.collection('teams').get();
    
    console.log(`📊 Total teams: ${teamsSnapshot.size}\n`);
    
    const unknownTeams = [];
    
    teamsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name === 'Unknown Team' || !data.name) {
        unknownTeams.push({
          id: doc.id,
          name: data.name,
          owner: data.owner,
          owner_name: data.owner_name,
          created_at: data.created_at
        });
      }
    });
    
    if (unknownTeams.length === 0) {
      console.log('✅ No teams with "Unknown Team" name found!');
    } else {
      console.log(`⚠️  Found ${unknownTeams.length} team(s) with "Unknown Team" name:\n`);
      unknownTeams.forEach(team => {
        console.log(`Team ID: ${team.id}`);
        console.log(`  Name: ${team.name || '(empty)'}`);
        console.log(`  Owner: ${team.owner_name || team.owner || '(unknown)'}`);
        console.log(`  Created: ${team.created_at ? new Date(team.created_at._seconds * 1000).toLocaleString() : '(unknown)'}`);
        console.log('');
      });
      
      console.log('💡 To fix these teams, update their names in Firebase Console or use a script.');
    }
    
    // Special check for SSPSLT0005
    const team5Doc = await db.collection('teams').doc('SSPSLT0005').get();
    if (team5Doc.exists) {
      console.log('\n📌 Team SSPSLT0005 details:');
      console.log(JSON.stringify(team5Doc.data(), null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkUnknownTeams();
