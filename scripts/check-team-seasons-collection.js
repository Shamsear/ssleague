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

async function checkTeamSeasons() {
  console.log('Checking team_seasons collection...\n');
  
  // Get sample documents from team_seasons
  const teamSeasonsSnapshot = await db.collection('team_seasons')
    .limit(5)
    .get();
  
  if (teamSeasonsSnapshot.empty) {
    console.log('❌ No documents found in team_seasons collection');
    return;
  }
  
  console.log(`✅ Found ${teamSeasonsSnapshot.size} sample documents\n`);
  
  teamSeasonsSnapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`\n--- Document ${index + 1} ---`);
    console.log(`Document ID: ${doc.id}`);
    console.log(`Team ID: ${data.team_id}`);
    console.log(`Season ID: ${data.season_id}`);
    console.log(`Balance: ${data.balance}`);
    console.log('\nFull data:');
    console.log(JSON.stringify(data, null, 2));
  });
  
  // Count by season
  console.log('\n\n--- Season Statistics ---');
  const allDocs = await db.collection('team_seasons').get();
  const seasonCounts = {};
  
  allDocs.forEach(doc => {
    const seasonId = doc.data().season_id;
    seasonCounts[seasonId] = (seasonCounts[seasonId] || 0) + 1;
  });
  
  console.log('Documents per season:');
  Object.entries(seasonCounts).sort().forEach(([season, count]) => {
    console.log(`  ${season}: ${count} teams`);
  });
}

checkTeamSeasons()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
