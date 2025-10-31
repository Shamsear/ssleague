import * as dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function createTable() {
  console.log('Creating team_trophies table...\n');
  
  await sql`
    CREATE TABLE IF NOT EXISTS team_trophies (
      id SERIAL PRIMARY KEY,
      team_id VARCHAR(255) NOT NULL,
      team_name VARCHAR(255) NOT NULL,
      season_id VARCHAR(255) NOT NULL,
      trophy_type VARCHAR(50) NOT NULL,
      trophy_name VARCHAR(255) NOT NULL,
      position INTEGER,
      awarded_by VARCHAR(50) DEFAULT 'system',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(team_id, season_id, trophy_name)
    )
  `;
  
  console.log('✅ Table created!\n');
  
  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_team_trophies_team_id ON team_trophies(team_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_team_trophies_season_id ON team_trophies(season_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_team_trophies_type ON team_trophies(trophy_type)`;
  
  console.log('✅ Indexes created!\n');
  
  // Verify
  const result = await sql`SELECT COUNT(*) as count FROM team_trophies`;
  console.log(`✅ Verified! Current trophy count: ${result[0].count}`);
}

createTable().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
