/**
 * Verify that passive points breakdown is being saved correctly
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function verifyBreakdown() {
  console.log('🔍 Verifying Passive Points Breakdown Storage...\n');

  try {
    // 1. Check if bonus_breakdown column exists and has data
    console.log('1️⃣ Checking bonus_breakdown column...');
    const bonusRecords = await fantasyDb`
      SELECT 
        team_id,
        fixture_id,
        round_number,
        bonus_breakdown,
        total_bonus,
        calculated_at
      FROM fantasy_team_bonus_points
      ORDER BY calculated_at DESC
      LIMIT 5
    `;

    if (bonusRecords.length === 0) {
      console.log('❌ No bonus records found in fantasy_team_bonus_points table');
      console.log('   This means either:');
      console.log('   - No fixtures have been completed yet');
      console.log('   - Fantasy points calculation is not being triggered');
      return;
    }

    console.log(`✅ Found ${bonusRecords.length} recent bonus records\n`);

    // 2. Check each record for breakdown data
    console.log('2️⃣ Checking breakdown data quality...');
    let recordsWithBreakdown = 0;
    let recordsWithoutBreakdown = 0;
    let recordsWithEmptyBreakdown = 0;

    bonusRecords.forEach((record, idx) => {
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  Round: ${record.round_number}`);
      console.log(`  Total Bonus: ${record.total_bonus}`);
      console.log(`  Calculated: ${new Date(record.calculated_at).toLocaleString()}`);
      
      let breakdown = record.bonus_breakdown;
      
      // Parse if string
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
          console.log(`  Breakdown (parsed from string): ${JSON.stringify(breakdown)}`);
        } catch (e) {
          console.log(`  ⚠️  Breakdown is string but failed to parse: ${breakdown}`);
          recordsWithoutBreakdown++;
          return;
        }
      } else if (breakdown && typeof breakdown === 'object') {
        console.log(`  Breakdown (object): ${JSON.stringify(breakdown)}`);
      } else {
        console.log(`  ⚠️  Breakdown is null or undefined`);
        recordsWithoutBreakdown++;
        return;
      }

      // Check if breakdown has data
      if (breakdown && Object.keys(breakdown).length > 0) {
        recordsWithBreakdown++;
        console.log(`  ✅ Has breakdown data`);
        
        // Show breakdown details
        Object.entries(breakdown).forEach(([type, value]) => {
          console.log(`     - ${type}: +${value}`);
        });
      } else {
        recordsWithEmptyBreakdown++;
        console.log(`  ⚠️  Breakdown is empty object`);
      }
    });

    console.log('\n\n3️⃣ Summary:');
    console.log(`  Total records checked: ${bonusRecords.length}`);
    console.log(`  ✅ With breakdown data: ${recordsWithBreakdown}`);
    console.log(`  ⚠️  Empty breakdown: ${recordsWithEmptyBreakdown}`);
    console.log(`  ❌ No breakdown: ${recordsWithoutBreakdown}`);

    // 4. Check if breakdown matches total_bonus
    console.log('\n4️⃣ Verifying breakdown totals match total_bonus...');
    let matchCount = 0;
    let mismatchCount = 0;

    for (const record of bonusRecords) {
      let breakdown = record.bonus_breakdown;
      if (typeof breakdown === 'string') {
        try {
          breakdown = JSON.parse(breakdown);
        } catch (e) {
          continue;
        }
      }

      if (breakdown && typeof breakdown === 'object') {
        const calculatedTotal = Object.values(breakdown).reduce((sum, val) => sum + (Number(val) || 0), 0);
        if (calculatedTotal === record.total_bonus) {
          matchCount++;
        } else {
          mismatchCount++;
          console.log(`  ⚠️  Mismatch in round ${record.round_number}: breakdown sum=${calculatedTotal}, total_bonus=${record.total_bonus}`);
        }
      }
    }

    console.log(`  ✅ Matching: ${matchCount}`);
    console.log(`  ❌ Mismatching: ${mismatchCount}`);

    // 5. Check if all teams have breakdown data
    console.log('\n5️⃣ Checking coverage across all teams...');
    const teamCoverage = await fantasyDb`
      SELECT 
        ft.team_id,
        ft.team_name,
        COUNT(ftbp.id) as bonus_records,
        SUM(ftbp.total_bonus) as total_passive_points,
        ft.passive_points as team_passive_points
      FROM fantasy_teams ft
      LEFT JOIN fantasy_team_bonus_points ftbp ON ft.team_id = ftbp.team_id
      WHERE ft.supported_team_id IS NOT NULL
      GROUP BY ft.team_id, ft.team_name, ft.passive_points
      ORDER BY bonus_records DESC
    `;

    console.log(`\nTeams with passive points:`);
    teamCoverage.forEach(team => {
      const match = team.total_passive_points === team.team_passive_points;
      console.log(`  ${team.team_name}: ${team.bonus_records} records, ${team.total_passive_points} pts ${match ? '✅' : '⚠️  (team shows ' + team.team_passive_points + ')'}`);
    });

    console.log('\n✅ Verification Complete!');
    
    if (recordsWithBreakdown === bonusRecords.length && mismatchCount === 0) {
      console.log('\n🎉 All passive points have proper breakdown data!');
    } else {
      console.log('\n⚠️  Some records are missing or have incorrect breakdown data');
      console.log('   This might be from old records before breakdown was implemented');
      console.log('   Run recalculation to fix: node scripts/recalculate-all-fantasy-points.js');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  }
}

verifyBreakdown()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
