import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  
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

const adminDb = admin.firestore();
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function checkManUnited() {
  console.log('🔍 Checking Manchester United data...\n');

  // Check Neon database
  const neonTeam = await sql`
    SELECT id, name, firebase_uid, football_budget, football_spent, football_players_count
    FROM teams
    WHERE name ILIKE '%manchester%'
    AND season_id = 'SSPSLS16'
  `;
  
  console.log('Neon Database:');
  if (neonTeam.length > 0) {
    const team = neonTeam[0];
    console.log(`  ID: ${team.id}`);
    console.log(`  Name: ${team.name}`);
    console.log(`  Firebase UID: ${team.firebase_uid}`);
    console.log(`  Football Budget: £${team.football_budget}`);
    console.log(`  Football Spent: £${team.football_spent}`);
    console.log(`  Players Count: ${team.football_players_count}`);
  } else {
    console.log('  ❌ Not found in Neon');
  }

  // Check Firebase
  if (neonTeam.length > 0) {
    const teamId = neonTeam[0].id;
    const tsDoc = await adminDb.collection('team_seasons').doc(`${teamId}_SSPSLS16`).get();
    
    console.log('\nFirebase team_seasons:');
    if (tsDoc.exists) {
      const data = tsDoc.data();
      console.log(`  Team Name: ${data?.team_name}`);
      console.log(`  Currency System: ${data?.currency_system}`);
      console.log(`  Football Budget: £${data?.football_budget}`);
      console.log(`  Budget (single): £${data?.budget}`);
      console.log(`  Football Spent: £${data?.football_spent}`);
      console.log(`  Total Spent: £${data?.total_spent}`);
      console.log(`  Players Count: ${data?.players_count}`);
    } else {
      console.log('  ❌ Not found in Firebase');
    }
  }

  // Check team_players
  if (neonTeam.length > 0) {
    const teamId = neonTeam[0].id;
    const players = await sql`
      SELECT player_id, purchase_price
      FROM team_players
      WHERE team_id = ${teamId}
      AND season_id = 'SSPSLS16'
    `;
    
    console.log(`\nTeam Players: ${players.length}`);
    players.forEach(p => {
      console.log(`  - Player ${p.player_id}: £${p.purchase_price}`);
    });
  }
}

checkManUnited().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
