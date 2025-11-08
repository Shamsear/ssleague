import { fantasySql } from '../lib/neon/fantasy-config';

async function checkRules() {
  const rules = await fantasySql`
    SELECT rule_type, rule_name, points_value 
    FROM fantasy_scoring_rules 
    WHERE league_id = 'SSPSLFLS16' 
    ORDER BY rule_type
  `;
  
  console.log('Existing rules:');
  rules.forEach((r: any) => {
    console.log(`  - ${r.rule_type}: ${r.rule_name} (${r.points_value} pts)`);
  });
}

checkRules().then(() => process.exit(0));
