/**
 * Check Real Players in Firebase
 * 
 * This script checks what's actually in the realplayers collection
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}-default-rtdb.firebaseio.com`,
      });
      console.log('✅ Firebase Admin initialized\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    throw new Error('Failed to initialize Firebase Admin SDK');
  }
}

const db = admin.firestore();

async function checkRealPlayers() {
  console.log('🔍 Checking Real Players in Firebase...\n');

  try {
    // Get all real players
    const realPlayersSnapshot = await db.collection('realplayers').get();
    
    console.log(`📊 Total Real Players: ${realPlayersSnapshot.size}\n`);

    if (realPlayersSnapshot.empty) {
      console.log('⚠️  No real players found in Firebase!');
      return;
    }

    // Group by team_id
    const byTeam = {};
    const bySeason = {};
    const noTeam = [];
    const noSeason = [];

    realPlayersSnapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      
      // Group by team
      if (data.team_id) {
        if (!byTeam[data.team_id]) {
          byTeam[data.team_id] = [];
        }
        byTeam[data.team_id].push({ docId, ...data });
      } else {
        noTeam.push({ docId, ...data });
      }

      // Group by season
      if (data.season_id) {
        if (!bySeason[data.season_id]) {
          bySeason[data.season_id] = [];
        }
        bySeason[data.season_id].push({ docId, ...data });
      } else {
        noSeason.push({ docId, ...data });
      }
    });

    console.log('📋 Real Players by Team:');
    console.log('='.repeat(80));
    for (const [teamId, players] of Object.entries(byTeam)) {
      console.log(`\n🏆 Team: ${teamId}`);
      console.log(`   Count: ${players.length}`);
      players.forEach(p => {
        console.log(`   - ${p.name || 'Unnamed'} (${p.player_id || docId})`);
        console.log(`     Season: ${p.season_id || 'NOT SET'}`);
        console.log(`     Team: ${p.team || 'N/A'}`);
      });
    }

    if (noTeam.length > 0) {
      console.log(`\n⚠️  Players without team_id: ${noTeam.length}`);
      noTeam.forEach(p => {
        console.log(`   - ${p.name || 'Unnamed'} (${p.docId})`);
      });
    }

    console.log('\n\n📋 Real Players by Season:');
    console.log('='.repeat(80));
    for (const [seasonId, players] of Object.entries(bySeason)) {
      console.log(`\n🏅 Season: ${seasonId}`);
      console.log(`   Count: ${players.length}`);
    }

    if (noSeason.length > 0) {
      console.log(`\n⚠️  Players without season_id: ${noSeason.length}`);
      noSeason.forEach(p => {
        console.log(`   - ${p.name || 'Unnamed'} (${p.docId}) - Team: ${p.team_id || 'N/A'}`);
      });
    }

    // Sample a few documents to see structure
    console.log('\n\n📄 Sample Real Player Documents:');
    console.log('='.repeat(80));
    const samples = realPlayersSnapshot.docs.slice(0, 3);
    samples.forEach((doc, idx) => {
      console.log(`\nSample ${idx + 1} (Doc ID: ${doc.id}):`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });

    console.log('\n✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error checking real players:', error);
    throw error;
  }
}

// Run the check
checkRealPlayers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
