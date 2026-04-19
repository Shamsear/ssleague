/**
 * Apply budget fixes to both Neon and Firebase
 * Updates football_budget and football_spent for all affected teams
 */

const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey || serviceAccountKey === 'undefined') {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in environment');
      console.log('Please set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
      process.exit(1);
    }
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

// Team data with corrections
const teamUpdates = [
  {
    id: 'SSPSLT0016',
    name: 'Blue Strikers',
    newBudget: 1831.00,
    spentIncrease: 1018,
  },
  {
    id: 'SSPSLT0006',
    name: 'FC Barcelona',
    newBudget: 3385.70,
    spentIncrease: 60,
  },
  {
    id: 'SSPSLT0008',
    name: 'La Masia',
    newBudget: 3906.80,
    spentIncrease: 60,
  },
  {
    id: 'SSPSLT0015',
    name: 'Legends FC',
    newBudget: 3986.70,
    spentIncrease: 60,
  },
  {
    id: 'SSPSLT0034',
    name: 'Los Blancos',
    newBudget: 1929.72,
    spentIncrease: 70,
  },
  {
    id: 'SSPSLT0021',
    name: 'Los Galacticos',
    newBudget: 1204.30,
    spentIncrease: 1820,
  },
  {
    id: 'SSPSLT0002',
    name: 'Manchester United',
    newBudget: 2053.90,
    spentIncrease: 570,
  },
  {
    id: 'SSPSLT0013',
    name: 'Psychoz',
    newBudget: 4077.00,
    spentIncrease: 60,
  },
  {
    id: 'SSPSLT0009',
    name: 'Qatar Gladiators',
    newBudget: 705.78,
    spentIncrease: 130,
  },
  {
    id: 'SSPSLT0004',
    name: 'Red Hawks FC',
    newBudget: 1585.00,
    spentIncrease: 220,
  },
  {
    id: 'SSPSLT0020',
    name: 'Skill 555',
    newBudget: 1687.10,
    spentIncrease: 70,
  },
  {
    id: 'SSPSLT0005',
    name: 'TM Asgardians',
    newBudget: 1514.00,
    spentIncrease: 90,
  },
  {
    id: 'SSPSLT0010',
    name: 'Varsity Soccers',
    newBudget: 3759.20,
    spentIncrease: 91,
  },
];

const seasonId = 'SSPSLS17';

async function applyBudgetFixes() {
  console.log('🔧 Starting budget fix application...\n');

  const results = [];

  for (const team of teamUpdates) {
    console.log(`\n📊 Processing ${team.name} (${team.id})...`);

    try {
      // 1. Get current values from Neon
      const neonBefore = await sql`
        SELECT football_budget, football_spent
        FROM teams
        WHERE id = ${team.id} AND season_id = ${seasonId}
      `;

      if (neonBefore.length === 0) {
        console.log(`   ❌ Team not found in Neon`);
        results.push({
          team: team.name,
          success: false,
          error: 'Team not found in Neon',
        });
        continue;
      }

      const neonCurrentBudget = parseFloat(neonBefore[0].football_budget);
      const neonCurrentSpent = parseFloat(neonBefore[0].football_spent);

      console.log(`   Neon Before: Budget £${neonCurrentBudget}, Spent £${neonCurrentSpent}`);

      // 2. Update Neon
      await sql`
        UPDATE teams
        SET 
          football_budget = ${team.newBudget},
          football_spent = football_spent + ${team.spentIncrease},
          updated_at = NOW()
        WHERE id = ${team.id} AND season_id = ${seasonId}
      `;

      // Verify Neon update
      const neonAfter = await sql`
        SELECT football_budget, football_spent
        FROM teams
        WHERE id = ${team.id} AND season_id = ${seasonId}
      `;

      const neonNewBudget = parseFloat(neonAfter[0].football_budget);
      const neonNewSpent = parseFloat(neonAfter[0].football_spent);

      console.log(`   ✅ Neon Updated: Budget £${neonNewBudget}, Spent £${neonNewSpent}`);

      // 3. Update Firebase
      const teamSeasonId = `${team.id}_${seasonId}`;
      const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonId);
      const teamSeasonSnap = await teamSeasonRef.get();

      if (!teamSeasonSnap.exists) {
        console.log(`   ⚠️  Team season ${teamSeasonId} not found in Firebase`);
        results.push({
          team: team.name,
          success: true,
          neon: true,
          firebase: false,
          error: 'Firebase document not found',
        });
        continue;
      }

      const teamSeasonData = teamSeasonSnap.data();
      const currencySystem = teamSeasonData?.currency_system || 'single';
      const isDualCurrency = currencySystem === 'dual';

      // Get current Firebase values
      const firebaseCurrentBudget = isDualCurrency
        ? (teamSeasonData?.football_budget || 0)
        : (teamSeasonData?.budget || 0);
      
      const firebaseCurrentSpent = isDualCurrency
        ? (teamSeasonData?.football_spent || 0)
        : (teamSeasonData?.total_spent || 0);

      console.log(`   Firebase Before: Budget £${firebaseCurrentBudget}, Spent £${firebaseCurrentSpent} (${currencySystem})`);

      // Prepare Firebase update
      const firebaseUpdate = {
        updated_at: new Date(),
      };

      if (isDualCurrency) {
        firebaseUpdate.football_budget = team.newBudget;
        firebaseUpdate.football_spent = firebaseCurrentSpent + team.spentIncrease;
      } else {
        firebaseUpdate.budget = team.newBudget;
        firebaseUpdate.total_spent = firebaseCurrentSpent + team.spentIncrease;
      }

      await teamSeasonRef.update(firebaseUpdate);

      // Verify Firebase update
      const verifySnap = await teamSeasonRef.get();
      const verifyData = verifySnap.data();
      const firebaseNewBudget = isDualCurrency
        ? verifyData.football_budget
        : verifyData.budget;
      const firebaseNewSpent = isDualCurrency
        ? verifyData.football_spent
        : verifyData.total_spent;

      console.log(`   ✅ Firebase Updated: Budget £${firebaseNewBudget}, Spent £${firebaseNewSpent}`);

      results.push({
        team: team.name,
        success: true,
        neon: true,
        firebase: true,
        neonBudget: neonNewBudget,
        neonSpent: neonNewSpent,
        firebaseBudget: firebaseNewBudget,
        firebaseSpent: firebaseNewSpent,
      });

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        team: team.name,
        success: false,
        error: error.message,
      });
    }
  }

  // Generate summary report
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 SUMMARY REPORT');
  console.log('='.repeat(80) + '\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${teamUpdates.length}`);
  console.log(`❌ Failed: ${failed.length}/${teamUpdates.length}\n`);

  if (successful.length > 0) {
    console.log('Successful Updates:');
    successful.forEach(r => {
      console.log(`  ✓ ${r.team}`);
      if (r.neon && r.firebase) {
        console.log(`    Neon: Budget £${r.neonBudget}, Spent £${r.neonSpent}`);
        console.log(`    Firebase: Budget £${r.firebaseBudget}, Spent £${r.firebaseSpent}`);
      }
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed Updates:');
    failed.forEach(r => {
      console.log(`  ✗ ${r.team}: ${r.error}`);
    });
  }

  // Save detailed report
  const reportFilename = `BUDGET_FIX_APPLIED_${Date.now()}.json`;
  fs.writeFileSync(reportFilename, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved: ${reportFilename}`);

  return results;
}

// Run the script
applyBudgetFixes()
  .then(() => {
    console.log('\n✅ Budget fix application completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
