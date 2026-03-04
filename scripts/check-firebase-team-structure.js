const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function checkStructure() {
  console.log('Checking Firebase team structure...\n');
  
  // Get first team
  const teamsSnapshot = await db.collection('teams').limit(1).get();
  
  if (teamsSnapshot.empty) {
    console.log('No teams found');
    return;
  }
  
  const teamDoc = teamsSnapshot.docs[0];
  const teamData = teamDoc.data();
  
  console.log('Team ID:', teamDoc.id);
  console.log('Team Name:', teamData.team_name);
  console.log('\nTeam Document Structure:');
  console.log(JSON.stringify(teamData, null, 2));
  
  // Check for team_seasons subcollection
  console.log('\n\nChecking team_seasons subcollection...');
  const teamSeasonsSnapshot = await db
    .collection('teams')
    .doc(teamDoc.id)
    .collection('team_seasons')
    .get();
  
  if (teamSeasonsSnapshot.empty) {
    console.log('No team_seasons subcollection found');
    console.log('\nChecking if seasons data is in main document...');
    if (teamData.seasons) {
      console.log('Found seasons in main document:');
      console.log(JSON.stringify(teamData.seasons, null, 2));
    }
  } else {
    console.log(`Found ${teamSeasonsSnapshot.size} season documents:`);
    teamSeasonsSnapshot.forEach(doc => {
      console.log(`\nSeason ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
}

checkStructure()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
