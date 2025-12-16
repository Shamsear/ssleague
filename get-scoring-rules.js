require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function getScoringRules() {
  const sql = neon(process.env.FANTASY_DATABASE_URL);
  
  console.log('🔍 Fetching scoring rules from database...\n');
  
  try {
    const rules = await sql`
      SELECT * FROM fantasy_scoring_rules
      WHERE is_active = true
      ORDER BY rule_type, rule_name
    `;
    
    console.log(`📊 Found ${rules.length} active scoring rules:\n`);
    
    // Group by rule_type
    const grouped = {};
    rules.forEach(rule => {
      if (!grouped[rule.rule_type]) {
        grouped[rule.rule_type] = [];
      }
      grouped[rule.rule_type].push(rule);
    });
    
    Object.keys(grouped).forEach(type => {
      console.log(`\n${type.toUpperCase()}:`);
      grouped[type].forEach(rule => {
        console.log(`  - ${rule.rule_name}: ${rule.points_value} points`);
        if (rule.description) {
          console.log(`    ${rule.description}`);
        }
      });
    });
    
    console.log('\n\n📋 Full data (JSON):');
    console.log(JSON.stringify(rules, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getScoringRules();
