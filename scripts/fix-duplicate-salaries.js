/**
 * Script to fix duplicate salary deductions from match rewards
 * 
 * This script:
 * 1. Finds duplicate match reward transactions
 * 2. Creates reversal transactions for duplicates
 * 3. Recalculates team balances
 * 
 * Usage: node scripts/fix-duplicate-salaries.js
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.NEON_TOURNAMENT_DB_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ NEON_TOURNAMENT_DB_URL or DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function findDuplicateTransactions() {
  console.log('🔍 Finding duplicate match reward transactions...\n');

  // Find transactions with same team_id and description within 5 minutes
  const duplicates = await sql`
    WITH duplicate_transactions AS (
      SELECT 
        t1.id as id1,
        t2.id as id2,
        t1.team_id,
        t1.season_id,
        t1.description,
        t1.amount_football,
        t1.amount_real,
        t1.created_at as time1,
        t2.created_at as time2,
        ABS(EXTRACT(EPOCH FROM (t1.created_at - t2.created_at))) as seconds_apart
      FROM transactions t1
      JOIN transactions t2 ON 
        t1.team_id = t2.team_id 
        AND t1.description = t2.description
        AND t1.transaction_type = 'match_reward'
        AND t2.transaction_type = 'match_reward'
        AND t1.amount_football = t2.amount_football
        AND t1.amount_real = t2.amount_real
        AND t1.id < t2.id
        AND ABS(EXTRACT(EPOCH FROM (t1.created_at - t2.created_at))) < 300
      WHERE t1.created_at >= '2024-12-16 00:00:00'
    )
    SELECT * FROM duplicate_transactions
    ORDER BY team_id, time1
  `;

  return duplicates;
}

async function createReversalTransaction(duplicate) {
  console.log(`  Creating reversal for transaction ${duplicate.id2}...`);

  await sql`
    INSERT INTO transactions (
      team_id,
      season_id,
      transaction_type,
      amount_football,
      amount_real,
      description,
      created_at
    ) VALUES (
      ${duplicate.team_id},
      ${duplicate.season_id},
      'adjustment',
      ${-duplicate.amount_football},
      ${-duplicate.amount_real},
      ${'Reversal: Duplicate salary deduction - ' + duplicate.description},
      NOW()
    )
  `;

  console.log(`  ✅ Reversal created: eCoin ${-duplicate.amount_football}, SSCoin ${-duplicate.amount_real}`);
}

async function recalculateTeamBalance(teamId) {
  console.log(`  Recalculating balance for team ${teamId}...`);

  await sql`
    UPDATE teams
    SET 
      football_budget = (
        SELECT COALESCE(SUM(amount_football), 0)
        FROM transactions
        WHERE team_id = ${teamId}
      ),
      real_budget = (
        SELECT COALESCE(SUM(amount_real), 0)
        FROM transactions
        WHERE team_id = ${teamId}
      ),
      updated_at = NOW()
    WHERE id = ${teamId}
  `;

  console.log(`  ✅ Balance recalculated`);
}

async function verifyFix() {
  console.log('\n🔍 Verifying team balances...\n');

  const mismatches = await sql`
    SELECT 
      t.id as team_id,
      t.team_name,
      t.football_budget as current_football_budget,
      t.real_budget as current_real_budget,
      COALESCE(SUM(tr.amount_football), 0) as calculated_football_budget,
      COALESCE(SUM(tr.amount_real), 0) as calculated_real_budget,
      t.football_budget - COALESCE(SUM(tr.amount_football), 0) as football_difference,
      t.real_budget - COALESCE(SUM(tr.amount_real), 0) as real_difference
    FROM teams t
    LEFT JOIN transactions tr ON t.id = tr.team_id
    GROUP BY t.id, t.team_name, t.football_budget, t.real_budget
    HAVING 
      ABS(t.football_budget - COALESCE(SUM(tr.amount_football), 0)) > 0.01
      OR ABS(t.real_budget - COALESCE(SUM(tr.amount_real), 0)) > 0.01
    ORDER BY t.team_name
  `;

  if (mismatches.length === 0) {
    console.log('✅ All team balances match transaction totals!');
  } else {
    console.log(`⚠️  Found ${mismatches.length} teams with balance mismatches:`);
    mismatches.forEach(team => {
      console.log(`  - ${team.team_name}: eCoin diff ${team.football_difference}, SSCoin diff ${team.real_difference}`);
    });
  }

  return mismatches;
}

async function main() {
  console.log('🚀 Starting duplicate salary deduction fix...\n');

  try {
    // Step 1: Find duplicates
    const duplicates = await findDuplicateTransactions();

    if (duplicates.length === 0) {
      console.log('✅ No duplicate transactions found!');
      return;
    }

    console.log(`Found ${duplicates.length} duplicate transaction(s):\n`);
    duplicates.forEach((dup, idx) => {
      console.log(`${idx + 1}. Team: ${dup.team_id}`);
      console.log(`   Description: ${dup.description}`);
      console.log(`   Amount: eCoin ${dup.amount_football}, SSCoin ${dup.amount_real}`);
      console.log(`   Times: ${dup.time1} and ${dup.time2} (${Math.round(dup.seconds_apart)}s apart)`);
      console.log('');
    });

    // Ask for confirmation
    console.log('⚠️  This will create reversal transactions for the duplicates.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Create reversals
    console.log('Creating reversal transactions...\n');
    const affectedTeams = new Set();

    for (const duplicate of duplicates) {
      await createReversalTransaction(duplicate);
      affectedTeams.add(duplicate.team_id);
    }

    // Step 3: Recalculate balances
    console.log('\nRecalculating team balances...\n');
    for (const teamId of affectedTeams) {
      await recalculateTeamBalance(teamId);
    }

    // Step 4: Verify
    await verifyFix();

    console.log('\n✅ Fix completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
