/**
 * Test the passive points breakdown API
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function testPassiveBreakdown() {
  console.log('🧪 Testing Passive Points Breakdown...\n');

  try {
    // 1. Find a team with passive points
    console.log('1️⃣ Finding a team with passive points...');
    const teamsWithPassive = await fantasyDb`
      SELECT 
        team_id,
        team_name,
        owner_name,
        supported_team_name,
        passive_points
      FROM fantasy_teams
      WHERE passive_points > 0
      ORDER BY passive_points DESC
      LIMIT 1
    `;

    if (teamsWithPassive.length === 0) {
      console.log('❌ No teams with passive points found');
      return;
    }

    const team = teamsWithPassive[0];
    console.log(`Found: ${team.team_name} (${team.owner_name})`);
    console.log(`  - Team ID: ${team.team_id}`);
    console.log(`  - Supported Team: ${team.supported_team_name}`);
    console.log(`  - Passive Points: ${team.passive_points}`);
    console.log('');

    // 2. Get passive points breakdown
    console.log('2️⃣ Fetching passive points breakdown...');
    const breakdown = await fantasyDb`
      SELECT 
        fixture_id,
        round_number,
        real_team_name,
        bonus_breakdown,
        total_bonus,
        calculated_at
      FROM fantasy_team_bonus_points
      WHERE team_id = ${team.team_id}
      ORDER BY round_number DESC
    `;

    console.log(`Found ${breakdown.length} rounds with bonuses:\n`);

    let totalFromBreakdown = 0;
    breakdown.forEach((round) => {
      totalFromBreakdown += round.total_bonus;
      
      // Parse bonus_breakdown
      let bonusDetails = round.bonus_breakdown;
      if (typeof bonusDetails === 'string') {
        try {
          bonusDetails = JSON.parse(bonusDetails);
        } catch (e) {
          bonusDetails = {};
        }
      }

      console.log(`  Round ${round.round_number}: +${round.total_bonus} points`);
      console.log(`    Team: ${round.real_team_name}`);
      
      if (bonusDetails && Object.keys(bonusDetails).length > 0) {
        console.log(`    Breakdown:`);
        Object.entries(bonusDetails).forEach(([type, value]) => {
          console.log(`      - ${type.replace(/_/g, ' ')}: +${value}`);
        });
      }
      console.log('');
    });

    // 3. Verify totals match
    console.log('3️⃣ Verifying totals...');
    console.log(`  Total from breakdown: ${totalFromBreakdown}`);
    console.log(`  Total in fantasy_teams: ${team.passive_points}`);
    
    if (totalFromBreakdown === team.passive_points) {
      console.log('  ✅ Totals match!');
    } else {
      console.log(`  ⚠️  Mismatch! Difference: ${Math.abs(totalFromBreakdown - team.passive_points)}`);
    }

    // 4. Calculate statistics
    console.log('\n4️⃣ Statistics:');
    const avgPerRound = breakdown.length > 0 ? (totalFromBreakdown / breakdown.length).toFixed(1) : 0;
    const bestRound = breakdown.length > 0 ? Math.max(...breakdown.map(r => r.total_bonus)) : 0;
    const roundsWithBonus = breakdown.filter(r => r.total_bonus > 0).length;

    console.log(`  - Total Rounds: ${breakdown.length}`);
    console.log(`  - Average per Round: ${avgPerRound}`);
    console.log(`  - Best Round: ${bestRound}`);
    console.log(`  - Rounds with Bonus: ${roundsWithBonus}`);

    console.log('\n✅ Test Complete!');
    console.log('\n💡 The API endpoint will return this data in a structured format');

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  }
}

testPassiveBreakdown()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
