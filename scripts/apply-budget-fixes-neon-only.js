/**
 * Apply budget fixes to Neon database only
 * Updates football_budget and football_spent for all affected teams
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

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

async function applyNeonBudgetFixes() {
  console.log('🔧 Starting Neon budget fix application...\n');

  const results = [];

  for (const team of teamUpdates) {
    console.log(`\n📊 Processing ${team.name} (${team.id})...`);

    try {
      // Get current values from Neon
      const neonBefore = await sql`
        SELECT football_budget, football_spent
        FROM teams
        WHERE id = ${team.id} AND season_id = ${seasonId}
      `;

      if (neonBefore.length === 0) {
        console.log(`   ❌ Team not found in Neon`);
        results.push({
          team: team.name,
          teamId: team.id,
          success: false,
          error: 'Team not found in Neon',
        });
        continue;
      }

      const neonCurrentBudget = parseFloat(neonBefore[0].football_budget);
      const neonCurrentSpent = parseFloat(neonBefore[0].football_spent);

      console.log(`   Before: Budget £${neonCurrentBudget}, Spent £${neonCurrentSpent}`);

      // Update Neon
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

      console.log(`   ✅ After: Budget £${neonNewBudget}, Spent £${neonNewSpent}`);
      console.log(`   Change: Budget ${neonCurrentBudget > neonNewBudget ? '-' : '+'}£${Math.abs(neonNewBudget - neonCurrentBudget).toFixed(2)}, Spent +£${team.spentIncrease}`);

      results.push({
        team: team.name,
        teamId: team.id,
        success: true,
        before: {
          budget: neonCurrentBudget,
          spent: neonCurrentSpent,
        },
        after: {
          budget: neonNewBudget,
          spent: neonNewSpent,
        },
        changes: {
          budgetChange: neonNewBudget - neonCurrentBudget,
          spentIncrease: team.spentIncrease,
        },
      });

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        team: team.name,
        teamId: team.id,
        success: false,
        error: error.message,
      });
    }
  }

  // Generate summary report
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 NEON UPDATE SUMMARY');
  console.log('='.repeat(80) + '\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${teamUpdates.length}`);
  console.log(`❌ Failed: ${failed.length}/${teamUpdates.length}\n`);

  if (successful.length > 0) {
    console.log('Successful Updates:');
    console.log('─'.repeat(80));
    successful.forEach(r => {
      console.log(`\n${r.team} (${r.teamId})`);
      console.log(`  Budget: £${r.before.budget} → £${r.after.budget} (${r.changes.budgetChange >= 0 ? '+' : ''}£${r.changes.budgetChange.toFixed(2)})`);
      console.log(`  Spent:  £${r.before.spent} → £${r.after.spent} (+£${r.changes.spentIncrease})`);
    });
  }

  if (failed.length > 0) {
    console.log('\n\nFailed Updates:');
    console.log('─'.repeat(80));
    failed.forEach(r => {
      console.log(`  ✗ ${r.team} (${r.teamId}): ${r.error}`);
    });
  }

  // Save detailed report
  const reportFilename = `NEON_BUDGET_FIX_APPLIED_${Date.now()}.json`;
  fs.writeFileSync(reportFilename, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved: ${reportFilename}`);

  console.log('\n' + '='.repeat(80));
  console.log('⚠️  NEXT STEP: Update Firebase');
  console.log('='.repeat(80));
  console.log('\nNeon database has been updated. You now need to update Firebase.');
  console.log('Options:');
  console.log('  1. Use the Budget Sync page: http://localhost:3000/dashboard/committee/reports/budget-sync');
  console.log('  2. Run the full script with Firebase credentials');
  console.log('  3. Update manually in Firebase console\n');

  return results;
}

// Run the script
applyNeonBudgetFixes()
  .then(() => {
    console.log('✅ Neon budget fix application completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
