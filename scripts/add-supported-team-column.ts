import { fantasySql } from '../lib/neon/fantasy-config';

async function addSupportedTeamColumn() {
  try {
    console.log('Adding supported_team columns to fantasy_teams...\n');

    await fantasySql`
      ALTER TABLE fantasy_teams 
      ADD COLUMN IF NOT EXISTS supported_team_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS supported_team_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS passive_points INTEGER DEFAULT 0
    `;

    console.log('✅ Columns added successfully!');

    await fantasySql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_teams_supported_team 
      ON fantasy_teams(supported_team_id)
    `;

    console.log('✅ Index created!');

    // Verify
    const result = await fantasySql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fantasy_teams' 
      AND column_name IN ('supported_team_id', 'supported_team_name', 'passive_points')
    `;

    console.log('\n✅ Verified columns:');
    result.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addSupportedTeamColumn();
