/**
 * Find team name in database
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function findTeam() {
  try {
    const searchTerm = process.argv[2] || 'psyhoz';
    console.log(`🔍 Searching for teams matching: "${searchTerm}"\n`);
    
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('season_id', '==', 'SSPSLS16')
      .where('status', '==', 'registered')
      .get();
    
    console.log(`Found ${teamSeasonsSnapshot.docs.length} registered teams in season SSPSLS16:\n`);
    
    teamSeasonsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const teamName = data.team_name || '';
      if (teamName.toLowerCase().includes(searchTerm.toLowerCase())) {
        console.log(`✅ MATCH: "${teamName}" (${data.team_id})`);
      } else {
        console.log(`   "${teamName}" (${data.team_id})`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

findTeam();
