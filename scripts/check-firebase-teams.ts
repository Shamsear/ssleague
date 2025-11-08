/**
 * Check and Fix Firebase Team Seasons
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';
import * as admin from 'firebase-admin';

config({ path: resolve(process.cwd(), '.env.local') });

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
  } else if (projectId) {
    admin.initializeApp({ projectId });
  } else {
    admin.initializeApp();
  }
}

const adminDb = admin.firestore();
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function checkAndFixFirebase() {
  console.log('🔍 Checking Firebase team_seasons...\n');

  // Get all team_seasons from Firebase
  const snapshot = await adminDb.collection('team_seasons').get();
  console.log(`Total team_seasons in Firebase: ${snapshot.size}\n`);

  const firebaseTeams: any[] = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    firebaseTeams.push({
      id: doc.id,
      team_name: data.team_name,
      season_id: data.season_id,
      budget: data.football_budget || data.budget || 0,
      spent: data.football_spent || 0,
      players_count: data.players_count || 0,
      currency_system: data.currency_system || 'single',
    });
  });

  // Get all teams from Neon
  const neonTeams = await sql`
    SELECT 
      id,
      name,
      season_id,
      firebase_uid,
      football_budget,
      football_spent,
      football_players_count
    FROM teams
    WHERE season_id IS NOT NULL
    ORDER BY name
  `;

  console.log('Firebase teams:');
  firebaseTeams.forEach(team => {
    console.log(`  ${team.id}`);
    console.log(`    Name: ${team.team_name}`);
    console.log(`    Budget: £${team.budget}, Spent: £${team.spent}, Players: ${team.players_count}\n`);
  });

  console.log('\nNeon teams:');
  neonTeams.forEach((team: any) => {
    console.log(`  ${team.name} (${team.id})`);
    console.log(`    Firebase UID: ${team.firebase_uid}`);
    console.log(`    Budget: £${team.football_budget}, Spent: £${team.football_spent}, Players: ${team.football_players_count}\n`);
  });

  // Now fix Firebase based on Neon data
  console.log('🔧 Syncing Firebase with Neon...\n');

  for (const neonTeam of neonTeams) {
    if (!neonTeam.firebase_uid) {
      console.log(`⚠️  ${neonTeam.name}: No firebase_uid, skipping`);
      continue;
    }

    // Try to find matching Firebase team_season (uses team_id, not firebase_uid)
    const teamSeasonId = `${neonTeam.id}_${neonTeam.season_id}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();

    if (!teamSeasonSnap.exists) {
      console.log(`⚠️  ${neonTeam.name}: Firebase team_season not found (${teamSeasonId})`);
      continue;
    }

    const teamSeasonData = teamSeasonSnap.data();
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const isDualCurrency = currencySystem === 'dual';

    const currentBudget = isDualCurrency 
      ? (teamSeasonData?.football_budget || 0)
      : (teamSeasonData?.budget || 0);
    const currentSpent = teamSeasonData?.football_spent || 0;

    // Check if update needed
    if (currentBudget === neonTeam.football_budget && currentSpent === neonTeam.football_spent) {
      console.log(`✅ ${neonTeam.name}: Already in sync`);
      continue;
    }

    // Update Firebase
    const updateData: any = {
      total_spent: neonTeam.football_spent,
      players_count: neonTeam.football_players_count,
      updated_at: new Date()
    };

    if (isDualCurrency) {
      updateData.football_budget = neonTeam.football_budget;
      updateData.football_spent = neonTeam.football_spent;
    } else {
      updateData.budget = neonTeam.football_budget;
    }

    await teamSeasonRef.update(updateData);
    console.log(`✅ ${neonTeam.name}: Updated Firebase`);
    console.log(`   Budget: £${currentBudget} → £${neonTeam.football_budget}`);
    console.log(`   Spent: £${currentSpent} → £${neonTeam.football_spent}`);
  }

  console.log('\n🎉 Sync complete!');
}

checkAndFixFirebase()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
