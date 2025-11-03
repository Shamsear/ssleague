import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });
import { neon } from '@neondatabase/serverless';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const adminDb = getFirestore();

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No DATABASE_URL or NEON_DATABASE_URL found in environment');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE')));
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface TeamSpending {
  team_id: string;
  season_id: string;
  total_spent: number;
  player_count: number;
}

async function fixTeamBudgets() {
  console.log('🔧 Starting team budget fix...\n');

  try {
    // Get all team spending from team_players (source of truth)
    const spendingResult = await sql`
      SELECT 
        team_id,
        season_id,
        SUM(purchase_price) as total_spent,
        COUNT(*) as player_count
      FROM team_players
      GROUP BY team_id, season_id
    `;

    console.log(`📊 Found ${spendingResult.length} team-season combinations with players\n`);

    for (const spending of spendingResult as TeamSpending[]) {
      const { team_id, season_id, total_spent, player_count } = spending;
      
      console.log(`\n🔄 Processing ${team_id} in ${season_id}:`);
      console.log(`   Total spent: £${total_spent.toLocaleString()}`);
      console.log(`   Players acquired: ${player_count}`);

      // 1. Update Neon teams table
      try {
        // First, get the team's initial budget
        const teamResult = await sql`
          SELECT id, firebase_uid 
          FROM teams 
          WHERE id = ${team_id}
        `;

        if (teamResult.length === 0) {
          console.log(`   ⚠️  Team ${team_id} not found in Neon - skipping`);
          continue;
        }

        const firebaseUid = teamResult[0].firebase_uid;

        // Get initial budget from Firebase team_seasons
        const teamSeasonId = `${team_id}_${season_id}`;
        const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
        
        if (!teamSeasonDoc.exists) {
          console.log(`   ⚠️  Team season ${teamSeasonId} not found in Firebase - skipping`);
          continue;
        }

        const teamSeasonData = teamSeasonDoc.data();
        const currencySystem = teamSeasonData?.currency_system || 'single';
        
        // Get the ORIGINAL budget (before any spending)
        let originalBudget = 0;
        if (currencySystem === 'dual') {
          // For dual system, we need to calculate: original = current + spent
          const currentFirebaseBudget = teamSeasonData?.football_budget || 0;
          const currentFirebaseSpent = teamSeasonData?.football_spent || 0;
          originalBudget = currentFirebaseBudget + currentFirebaseSpent;
        } else {
          const currentBudget = teamSeasonData?.budget || 0;
          const currentTotalSpent = teamSeasonData?.total_spent || 0;
          originalBudget = currentBudget + currentTotalSpent;
        }

        const correctBudget = originalBudget - total_spent;

        // Update Neon
        await sql`
          UPDATE teams
          SET 
            football_spent = ${total_spent},
            football_budget = ${correctBudget},
            updated_at = NOW()
          WHERE id = ${team_id}
        `;
        
        console.log(`   ✅ Neon: football_spent = £${total_spent.toLocaleString()}, football_budget = £${correctBudget.toLocaleString()}`);

        // 2. Update Firebase team_seasons
        const updateData: any = {
          total_spent: total_spent,
          players_count: player_count,
          updated_at: new Date()
        };

        if (currencySystem === 'dual') {
          updateData.football_spent = total_spent;
          updateData.football_budget = correctBudget;
        } else {
          updateData.budget = correctBudget;
        }

        await adminDb.collection('team_seasons').doc(teamSeasonId).update(updateData);
        
        console.log(`   ✅ Firebase: total_spent = £${total_spent.toLocaleString()}, players_count = ${player_count}`);

      } catch (error) {
        console.error(`   ❌ Error updating ${team_id}:`, error);
      }
    }

    // 3. Reset teams with no players (spending should be 0)
    console.log('\n🔄 Resetting teams with no players...');
    
    const allTeamsResult = await sql`
      SELECT t.id, t.season_id, t.firebase_uid
      FROM teams t
      WHERE NOT EXISTS (
        SELECT 1 FROM team_players tp 
        WHERE tp.team_id = t.id AND tp.season_id = t.season_id
      )
    `;

    console.log(`📊 Found ${allTeamsResult.length} teams with no players\n`);

    for (const team of allTeamsResult) {
      try {
        const teamSeasonId = `${team.id}_${team.season_id}`;
        const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
        
        if (!teamSeasonDoc.exists) continue;

        const teamSeasonData = teamSeasonDoc.data();
        const currencySystem = teamSeasonData?.currency_system || 'single';
        
        // Get original budget
        let originalBudget = 0;
        if (currencySystem === 'dual') {
          originalBudget = (teamSeasonData?.football_budget || 0) + (teamSeasonData?.football_spent || 0);
        } else {
          originalBudget = (teamSeasonData?.budget || 0) + (teamSeasonData?.total_spent || 0);
        }

        // Reset to 0 spending
        await sql`
          UPDATE teams
          SET 
            football_spent = 0,
            football_budget = ${originalBudget},
            updated_at = NOW()
          WHERE id = ${team.id}
        `;

        const resetData: any = {
          total_spent: 0,
          players_count: 0,
          updated_at: new Date()
        };

        if (currencySystem === 'dual') {
          resetData.football_spent = 0;
          resetData.football_budget = originalBudget;
        } else {
          resetData.budget = originalBudget;
        }

        await adminDb.collection('team_seasons').doc(teamSeasonId).update(resetData);
        
        console.log(`   ✅ Reset ${team.id}: spent = £0, budget = £${originalBudget.toLocaleString()}`);
      } catch (error) {
        console.error(`   ❌ Error resetting ${team.id}:`, error);
      }
    }

    console.log('\n✅ Budget fix completed!\n');
  } catch (error) {
    console.error('❌ Error fixing budgets:', error);
    process.exit(1);
  }
}

// Run the script
fixTeamBudgets().then(() => {
  console.log('Done!');
  process.exit(0);
});
