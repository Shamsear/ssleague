const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const db = admin.firestore();
const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.DATABASE_URL);

async function checkTeamNames() {
  const playerId = '162163'; // Aleksandar Pavlović
  
  // Get player history
  const history = await sql`
    SELECT id, player_id, player_name, team_id, team_name, club, acquisition_type, acquisition_date
    FROM player_history
    WHERE player_id = ${playerId}
    ORDER BY acquisition_date DESC
    LIMIT 3
  `;
  
  console.log('\nPlayer History:');
  for (const h of history) {
    console.log(`\n  ${h.acquisition_type} - ${h.acquisition_date}`);
    console.log(`    team_id: ${h.team_id}`);
    console.log(`    team_name: ${h.team_name}`);
    console.log(`    club: ${h.club}`);
    
    // Get actual team name from Firebase
    const teamDoc = await db.collection('teams').doc(h.team_id).get();
    if (teamDoc.exists) {
      console.log(`    Firebase team name: ${teamDoc.data().name}`);
    }
  }
  
  // Get current player data
  const player = await sql`
    SELECT player_id, name, team_id, club
    FROM footballplayers
    WHERE player_id = ${playerId}
  `;
  
  console.log('\n\nCurrent Player Data:');
  console.log(`  name: ${player[0].name}`);
  console.log(`  team_id: ${player[0].team_id}`);
  console.log(`  club: ${player[0].club}`);
  
  const currentTeamDoc = await db.collection('teams').doc(player[0].team_id).get();
  if (currentTeamDoc.exists) {
    console.log(`  Firebase team name: ${currentTeamDoc.data().name}`);
  }
}

checkTeamNames().then(() => process.exit(0));
