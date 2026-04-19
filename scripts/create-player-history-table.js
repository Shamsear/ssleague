require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function createTable() {
  console.log('\n📊 Creating player_history table...\n');
  
  try {
    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS player_history (
        id SERIAL PRIMARY KEY,
        
        player_id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        position VARCHAR(50),
        
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255) NOT NULL,
        season_id VARCHAR(255) NOT NULL,
        
        acquisition_type VARCHAR(50) NOT NULL,
        acquisition_value INTEGER,
        acquisition_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        status VARCHAR(50) DEFAULT 'active',
        end_date TIMESTAMP,
        end_reason VARCHAR(50),
        
        round_id VARCHAR(255),
        transaction_id VARCHAR(255),
        related_history_id INTEGER,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Table created');
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_player_history_player_id ON player_history(player_id)`;
    console.log('✅ Index on player_id created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_player_history_team_id ON player_history(team_id)`;
    console.log('✅ Index on team_id created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_player_history_season_id ON player_history(season_id)`;
    console.log('✅ Index on season_id created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_player_history_status ON player_history(status)`;
    console.log('✅ Index on status created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_player_history_player_team_season ON player_history(player_id, team_id, season_id)`;
    console.log('✅ Composite index created');
    
    console.log('\n✅ player_history table created successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    process.exit(1);
  }
}

createTable();
