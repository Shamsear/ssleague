require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized\n');
}

const db = admin.firestore();

async function checkAndFixTeamSeasons() {
  try {
    console.log('🔍 Checking team_seasons collection...\n');

    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    console.log(`Found ${teamsSnapshot.size} teams\n`);

    // Check team_seasons collection
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    console.log(`Found ${teamSeasonsSnapshot.size} team_seasons documents\n`);

    if (teamSeasonsSnapshot.size === 0) {
      console.log('⚠️  No team_seasons documents found!');
      console.log('This is why rewards are not being distributed.\n');
      console.log('Creating team_seasons documents from teams...\n');

      let created = 0;
      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const teamId = teamDoc.id;
        
        // Determine season_id - check if team has it, otherwise use a default
        let seasonId = teamData.season_id;
        
        if (!seasonId) {
          // Try to infer from team ID pattern (e.g., SSPSLT0001 might be from a specific season)
          // For now, we'll skip teams without season_id
          console.log(`⚠️  Team ${teamId} (${teamData.name || 'Unknown'}) has no season_id, skipping`);
          continue;
        }

        const teamSeasonId = `${teamId}_${seasonId}`;
        
        // Check if team_season document already exists
        const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonDoc = await teamSeasonRef.get();
        
        if (!teamSeasonDoc.exists) {
          // Create team_season document
          await teamSeasonRef.set({
            team_id: teamId,
            season_id: seasonId,
            football_budget: teamData.balance || 0,
            real_player_budget: teamData.real_player_budget || 0,
            total_spent: teamData.total_spent || 0,
            created_at: new Date(),
            updated_at: new Date()
          });
          
          console.log(`✅ Created team_season: ${teamSeasonId} for ${teamData.name || teamId}`);
          created++;
        }
      }

      console.log(`\n✅ Created ${created} team_season documents`);
    } else {
      console.log('✅ team_seasons collection exists\n');
      
      // Show sample documents
      console.log('Sample team_seasons documents:');
      teamSeasonsSnapshot.docs.slice(0, 5).forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}:`);
        console.log(`      Team ID: ${data.team_id}`);
        console.log(`      Season ID: ${data.season_id}`);
        console.log(`      Football Budget: ${data.football_budget || 0}`);
        console.log(`      Real Budget: ${data.real_player_budget || 0}`);
      });
    }

    // Now check if rewards can be distributed
    console.log('\n\n🎁 Testing reward distribution readiness...\n');
    
    const testTeamId = teamsSnapshot.docs[0]?.id;
    const testTeamData = teamsSnapshot.docs[0]?.data();
    const testSeasonId = testTeamData?.season_id;
    
    if (testTeamId && testSeasonId) {
      const teamSeasonDocId = `${testTeamId}_${testSeasonId}`;
      const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonDocId);
      const teamSeasonDoc = await teamSeasonRef.get();
      
      if (teamSeasonDoc.exists) {
        console.log(`✅ Test passed: team_season document exists for ${testTeamData.name || testTeamId}`);
        console.log(`   Document ID: ${teamSeasonDocId}`);
        console.log(`   Current budgets: eCoin ${teamSeasonDoc.data()?.football_budget || 0}, SSCoin ${teamSeasonDoc.data()?.real_player_budget || 0}`);
      } else {
        console.log(`❌ Test failed: team_season document NOT found for ${testTeamData.name || testTeamId}`);
        console.log(`   Expected document ID: ${teamSeasonDocId}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkAndFixTeamSeasons()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
