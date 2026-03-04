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

async function checkSeasonData() {
  console.log('Checking team season data structure...\n');
  
  // Get teams with SSPSLS16 season
  const teamsSnapshot = await db.collection('teams').get();
  
  console.log(`Found ${teamsSnapshot.size} teams\n`);
  
  // Check first few teams for season data structure
  let foundSeasonData = false;
  
  for (const teamDoc of teamsSnapshot.docs.slice(0, 5)) {
    const teamData = teamDoc.data();
    console.log(`\nTeam: ${teamData.team_name} (${teamDoc.id})`);
    
    // Check if there's a seasons object with nested data
    if (teamData.seasons && typeof teamData.seasons === 'object' && !Array.isArray(teamData.seasons)) {
      console.log('  ✅ Has seasons object with nested data');
      foundSeasonData = true;
      
      // Show structure of seasons
      const seasonKeys = Object.keys(teamData.seasons);
      console.log(`  Seasons: ${seasonKeys.join(', ')}`);
      
      // Show first season's data structure
      if (seasonKeys.length > 0) {
        const firstSeason = seasonKeys[0];
        console.log(`\n  Sample season data (${firstSeason}):`);
        console.log(JSON.stringify(teamData.seasons[firstSeason], null, 4));
      }
      
      break; // Found what we need
    } else if (Array.isArray(teamData.seasons)) {
      console.log('  ℹ️  Has seasons as array:', teamData.seasons);
    } else {
      console.log('  ⚠️  No seasons data found');
    }
  }
  
  if (!foundSeasonData) {
    console.log('\n❌ No teams found with nested season data structure');
  }
}

checkSeasonData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
