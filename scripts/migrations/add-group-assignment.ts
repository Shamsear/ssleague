import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

async function addGroupAssignment() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🚀 Adding group assignment features');

  try {
    // Add group_assignment_mode field
    console.log('1/2: Adding group_assignment_mode field...');
    await sql`
      ALTER TABLE tournaments 
      ADD COLUMN IF NOT EXISTS group_assignment_mode VARCHAR(20) DEFAULT 'auto'
    `;
    
    await sql`
      UPDATE tournaments 
      SET group_assignment_mode = 'auto'
      WHERE group_assignment_mode IS NULL
    `;
    console.log('✅ Field added');

    // Create tournament_team_groups table
    console.log('2/2: Creating tournament_team_groups table...');
    await sql`
      CREATE TABLE IF NOT EXISTS tournament_team_groups (
          id SERIAL PRIMARY KEY,
          tournament_id TEXT NOT NULL,
          team_id TEXT NOT NULL,
          group_name VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(tournament_id, team_id),
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_tournament_team_groups_tournament ON tournament_team_groups(tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournament_team_groups_team ON tournament_team_groups(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournament_team_groups_group ON tournament_team_groups(group_name)`;
    
    console.log('✅ Table created');

    // Verify
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tournaments' AND column_name = 'group_assignment_mode'
    `;
    console.log('\n📊 Verification:');
    console.table(result);

    console.log('\n✨ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addGroupAssignment()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
