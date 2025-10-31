const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function createTable() {
  console.log('\n================================================================================');
  console.log('CREATING PLAYER_AWARDS TABLE');
  console.log('================================================================================\n');

  try {
    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS player_awards (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        season_id INTEGER NOT NULL,
        award_name VARCHAR(255) NOT NULL,
        award_position VARCHAR(100),
        award_value NUMERIC(10, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT unique_player_season_award UNIQUE (player_id, season_id, award_name)
      )
    `;
    console.log('✅ Table created');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_player_id ON player_awards(player_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_season_id ON player_awards(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_player_season ON player_awards(player_id, season_id)`;
    console.log('✅ Indexes created');

    // Verify
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_awards'
      ORDER BY ordinal_position
    `;

    console.log('\n✅ Table structure:');
    result.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  - ${col.column_name}: ${col.data_type} (${nullable})`);
    });

    console.log('\n================================================================================');
    console.log('SUCCESS!');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

createTable();
