import { fantasySql } from '../../lib/neon/fantasy-config';

async function addAppliesToColumn() {
  try {
    console.log('🔧 Adding applies_to column to fantasy_scoring_rules...');
    
    // Add the column
    await fantasySql`
      ALTER TABLE fantasy_scoring_rules 
      ADD COLUMN IF NOT EXISTS applies_to VARCHAR(50) DEFAULT 'player'
    `;
    
    console.log('✅ Column added successfully');
    
    // Update existing rules
    await fantasySql`
      UPDATE fantasy_scoring_rules 
      SET applies_to = 'player' 
      WHERE applies_to IS NULL
    `;
    
    console.log('✅ Updated existing rules with default value');
    console.log('✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addAppliesToColumn();
