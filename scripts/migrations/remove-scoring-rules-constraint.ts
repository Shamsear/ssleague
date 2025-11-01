import { fantasySql } from '../../lib/neon/fantasy-config';

async function removeUniqueConstraint() {
  try {
    console.log('🔧 Removing unique constraint on fantasy_scoring_rules...');
    
    // Drop the unique constraint
    await fantasySql`
      ALTER TABLE fantasy_scoring_rules 
      DROP CONSTRAINT IF EXISTS fantasy_scoring_rules_league_id_rule_type_key
    `;
    
    console.log('✅ Removed constraint: fantasy_scoring_rules_league_id_rule_type_key');
    
    // Add new constraint to prevent exact duplicates
    await fantasySql`
      ALTER TABLE fantasy_scoring_rules 
      DROP CONSTRAINT IF EXISTS fantasy_scoring_rules_league_rule_name_key
    `;
    
    await fantasySql`
      ALTER TABLE fantasy_scoring_rules 
      ADD CONSTRAINT fantasy_scoring_rules_league_rule_name_key 
      UNIQUE (league_id, rule_type, rule_name)
    `;
    
    console.log('✅ Added new constraint: fantasy_scoring_rules_league_rule_name_key');
    console.log('✅ Migration complete! You can now create multiple rules of the same type.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

removeUniqueConstraint();
