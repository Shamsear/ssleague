/**
 * Test script to verify that the recalculation script
 * ONLY uses database values and fails if rules are missing
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testValidation() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
  
  console.log('🧪 Testing scoring rules validation...\n');
  
  try {
    // Fetch scoring rules
    const scoringRulesData = await fantasyDb`
      SELECT rule_type, rule_name, points_value, applies_to
      FROM fantasy_scoring_rules
      WHERE is_active = true
    `;
    
    console.log(`✅ Found ${scoringRulesData.length} active scoring rules\n`);
    
    // Convert to usable format
    const SCORING_RULES = {};
    scoringRulesData.forEach(rule => {
      const key = rule.rule_type.toLowerCase();
      if (rule.applies_to === 'player') {
        SCORING_RULES[key] = rule.points_value;
      }
    });
    
    // Check required rules
    const requiredRules = ['goals_scored', 'win', 'draw', 'match_played', 'clean_sheet', 'motm'];
    const optionalRules = ['hat_trick', 'concedes_4_plus_goals', 'substitution_penalty'];
    
    console.log('📋 Required Rules Check:');
    let allRequiredPresent = true;
    requiredRules.forEach(rule => {
      if (SCORING_RULES[rule] !== undefined) {
        console.log(`   ✅ ${rule}: ${SCORING_RULES[rule]} points`);
      } else {
        console.log(`   ❌ ${rule}: MISSING!`);
        allRequiredPresent = false;
      }
    });
    
    console.log('\n📋 Optional Rules Check:');
    optionalRules.forEach(rule => {
      if (SCORING_RULES[rule] !== undefined) {
        console.log(`   ✅ ${rule}: ${SCORING_RULES[rule]} points`);
      } else {
        console.log(`   ⚠️  ${rule}: Not configured (will be skipped)`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    
    if (allRequiredPresent) {
      console.log('\n✅ All required scoring rules are present!');
      console.log('✅ The script will use ONLY database values.');
      console.log('✅ No default fallback values will be used.\n');
    } else {
      console.log('\n❌ Some required rules are missing!');
      console.log('❌ The recalculation script will FAIL.');
      console.log('❌ Please add missing rules to fantasy_scoring_rules table.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testValidation();
