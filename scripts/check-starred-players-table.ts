import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkTable() {
  console.log('🔍 Checking starred_players table...\n');

  try {
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'starred_players'
      )
    `;
    
    console.log('Table exists:', tableCheck[0].exists);

    if (tableCheck[0].exists) {
      // Get table structure
      console.log('\n📋 Table structure:');
      const columns = await sql`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'starred_players'
        ORDER BY ordinal_position
      `;
      console.table(columns);

      // Get constraints
      console.log('\n🔒 Constraints:');
      const constraints = await sql`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'starred_players'::regclass
      `;
      console.table(constraints);

      // Get sample data
      console.log('\n📊 Sample data (first 5 rows):');
      const sample = await sql`
        SELECT * FROM starred_players LIMIT 5
      `;
      console.table(sample);

      // Get count
      const count = await sql`SELECT COUNT(*) as total FROM starred_players`;
      console.log(`\nTotal starred players: ${count[0].total}`);
    } else {
      console.log('\n❌ Table does not exist! Creating it now...\n');
      
      await sql`
        CREATE TABLE starred_players (
          id SERIAL PRIMARY KEY,
          team_id VARCHAR(255) NOT NULL,
          player_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_team_player UNIQUE (team_id, player_id)
        )
      `;
      
      await sql`
        CREATE INDEX idx_starred_players_team ON starred_players(team_id)
      `;
      
      await sql`
        CREATE INDEX idx_starred_players_player ON starred_players(player_id)
      `;
      
      console.log('✅ Table created with indexes!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkTable().catch(console.error);
