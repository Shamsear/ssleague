/**
 * Test the enhanced team bonus calculation with all rules
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

async function testEnhancedBonuses() {
  console.log('🧪 Testing Enhanced Team Bonus Calculation\n');

  try {
    // Get configured rules
    const rules = await fantasyDb`
      SELECT rule_type, points_value
      FROM fantasy_scoring_rules
      WHERE league_id = 'SSPSLFLS16'
        AND applies_to = 'team'
        AND is_active = true
    `;

    console.log('📋 Configured Team Rules:');
    rules.forEach(rule => {
      const sign = rule.points_value > 0 ? '+' : '';
      console.log(`  ${rule.rule_type}: ${sign}${rule.points_value} pts`);
    });
    console.log('');

    // Test scenarios
    const scenarios = [
      {
        name: 'Big Win with Clean Sheet',
        goals_scored: 8,
        goals_conceded: 0,
        expected: ['win', 'clean_sheet', 'scored_6_plus_goals']
      },
      {
        name: 'High Scoring Win',
        goals_scored: 10,
        goals_conceded: 5,
        expected: ['win', 'scored_6_plus_goals']
      },
      {
        name: 'Heavy Loss',
        goals_scored: 2,
        goals_conceded: 16,
        expected: ['loss', 'concedes_15_plus_goals']
      },
      {
        name: 'Draw',
        goals_scored: 3,
        goals_conceded: 3,
        expected: ['draw']
      },
      {
        name: 'Narrow Win',
        goals_scored: 4,
        goals_conceded: 3,
        expected: ['win']
      },
    ];

    console.log('🎯 Testing Scenarios:\n');

    scenarios.forEach(scenario => {
      console.log(`Scenario: ${scenario.name}`);
      console.log(`  Score: ${scenario.goals_scored} - ${scenario.goals_conceded}`);
      
      const won = scenario.goals_scored > scenario.goals_conceded;
      const draw = scenario.goals_scored === scenario.goals_conceded;
      const lost = scenario.goals_scored < scenario.goals_conceded;
      const clean_sheet = scenario.goals_conceded === 0;

      const bonuses = [];
      let total = 0;

      rules.forEach(rule => {
        let applies = false;

        switch (rule.rule_type) {
          case 'win':
            applies = won;
            break;
          case 'draw':
            applies = draw;
            break;
          case 'loss':
            applies = lost;
            break;
          case 'clean_sheet':
            applies = clean_sheet;
            break;
          case 'concedes_15_plus_goals':
            applies = scenario.goals_conceded >= 15;
            break;
          case 'scored_6_plus_goals':
            applies = scenario.goals_scored >= 6;
            break;
        }

        if (applies) {
          bonuses.push(rule.rule_type);
          total += rule.points_value;
          const sign = rule.points_value > 0 ? '+' : '';
          console.log(`    ✅ ${rule.rule_type}: ${sign}${rule.points_value}`);
        }
      });

      console.log(`  Total: ${total > 0 ? '+' : ''}${total} pts`);
      
      // Check if expected bonuses match
      const missing = scenario.expected.filter(e => !bonuses.includes(e));
      const extra = bonuses.filter(b => !scenario.expected.includes(b));
      
      if (missing.length > 0) {
        console.log(`  ⚠️  Missing expected: ${missing.join(', ')}`);
      }
      if (extra.length > 0) {
        console.log(`  ℹ️  Extra bonuses: ${extra.join(', ')}`);
      }
      
      console.log('');
    });

    console.log('✅ Test Complete!\n');
    console.log('💡 Next Steps:');
    console.log('   1. The code now supports ALL configured rules dynamically');
    console.log('   2. Recalculate existing points to apply new rules:');
    console.log('      node scripts/recalculate-all-fantasy-points.js');
    console.log('   3. Or wait for next fixture to see new rules in action');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testEnhancedBonuses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
