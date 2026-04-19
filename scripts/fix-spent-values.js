/**
 * Fix football_spent values in Neon - SET to exact amounts (not increment)
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

// Team data with CORRECT spent values (the total amount they should have spent)
const teamUpdates = [
  {
    id: 'SSPSLT0016',
    name: 'Blue Strikers',
    newBudget: 1831.00,
    correctSpent: 1018, // Total spent (not increment)
  },
  {
    id: 'SSPSLT0006',
    name: 'FC Barcelona',
    newBudget: 3385.70,
    correctSpent: 60,
  },
  {
    id: 'SSPSLT0008',
    name: 'La Masia',
    newBudget: 3906.80,
    correctSpent: 60,
  },
  {
    id: 'SSPSLT0015',
    name: 'Legends FC',
    newBudget: 3986.70,
    correctSpent: 60,
  },
  {
    id: 'SSPSLT0034',
    name: 'Los Blancos',
    newBudget: 1929.72,
    correctSpent: 70,
  },
  {
    id: 'SSPSLT0021',
    name: 'Los Galacticos',
    newBudget: 1204.30,
    correctSpent: 1820,
  },
  {
    id: 'SSPSLT0002',
    name: 'Manchester United',
    newBudget: 2053.90,
    correctSpent: 570,
  },
  {
    id: 'SSPSLT0013',
    name: 'Psychoz',
    newBudget: 4077.00,
    correctSpent: 60,
  },
  {
    id: 'SSPSLT0009',
    name: 'Qatar Gladiators',
    newBudget: 705.78,
    correctSpent: 130,
  },
  {
    id: 'SSPSLT0004',
    name: 'Red Hawks FC',
    newBudget: 1585.00,
    correctSpent: 220,
  },
  {
    id: 'SSPSLT0020',
    name: 'Skill 555',
    newBudget: 1687.10,
    correctSpent: 70,
  },
  {
    id: 'SSPSLT0005',
    name: 'TM Asgardians',
    newBudget: 1514.00,
    correctSpent: 90,
  },
  {
    id: 'SSPSLT0010',
    name: 'Varsity Soccers',
    newBudget: 3759.20,
    correctSpent: 91,
  },
];

const seasonId = 'SSPSLS17';

async function fixSpentValues() {
  console.log('🔧 Fixing football_spent values in Neon...\n');

  const results = [];

  for (const team of teamUpdates) {
    console.log(`\n📊 Processing ${team.name} (${team.id})...`);

    try {
      // Get current values
      const before = await sql`
        SELECT football_budget, football_spent
        FROM teams
        WHERE id = ${team.id} AND season_id = ${seasonId}
      `;

      if (before.length === 0) {
        console.log(`   ❌ Team not found`);
        results.push({
          team: team.name,
          teamId: team.id,
          success: false,
          error: 'Team not found',
        });
        continue;
      }

      const currentBudget = parseFloat(before[0].football_budget);
      const currentSpent = parseFloat(before[0].football_spent);

      console.log(`   Before: Budget £${currentBudget}, Spent £${currentSpent}`);

      // Update with CORRECT values - SET spent to exact amount
      await sql`
        UPDATE teams
        SET 
          football_budget = ${team.newBudget},
          football_spent = ${team.correctSpent},
          updated_at = NOW()
        WHERE id = ${team.id} AND season_id = ${seasonId}
      `;

      // Verify update
      const after = await sql`
        SELECT football_budget, football_spent
        FROM teams
        WHERE id = ${team.id} AND season_id = ${seasonId}
      `;

      const newBudget = parseFloat(after[0].football_budget);
      const newSpent = parseFloat(after[0].football_spent);

      console.log(`   ✅ After: Budget £${newBudget}, Spent £${newSpent}`);

      results.push({
        team: team.name,
        teamId: team.id,
        success: true,
        before: {
          budget: currentBudget,
          spent: currentSpent,
        },
        after: {
          budget: newBudget,
          spent: newSpent,
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

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 SPENT VALUES FIX SUMMARY');
  console.log('='.repeat(80) + '\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${teamUpdates.length}`);
  console.log(`❌ Failed: ${failed.length}/${teamUpdates.length}\n`);

  if (successful.length > 0) {
    console.log('Updated Teams:');
    console.log('─'.repeat(80));
    successful.forEach(r => {
      console.log(`\n${r.team} (${r.teamId})`);
      console.log(`  Budget: £${r.before.budget} → £${r.after.budget}`);
      console.log(`  Spent:  £${r.before.spent} → £${r.after.spent} ✓`);
    });
  }

  if (failed.length > 0) {
    console.log('\n\nFailed Updates:');
    console.log('─'.repeat(80));
    failed.forEach(r => {
      console.log(`  ✗ ${r.team} (${r.teamId}): ${r.error}`);
    });
  }

  // Save report
  const reportFilename = `SPENT_VALUES_FIXED_${Date.now()}.json`;
  fs.writeFileSync(reportFilename, JSON.stringify(results, null, 2));
  console.log(`\n📄 Report saved: ${reportFilename}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Neon database updated with correct spent values');
  console.log('='.repeat(80));
  console.log('\nNext: Update Firebase using budget sync page');
  console.log('URL: http://localhost:3000/dashboard/committee/reports/budget-sync\n');

  return results;
}

// Run
fixSpentValues()
  .then(() => {
    console.log('✅ Script completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
