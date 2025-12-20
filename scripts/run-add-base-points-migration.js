require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

async function runMigration() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  console.log('🔄 Running migration: add_base_points_to_player_seasons\n');
  
  try {
    // Add column
    await sql`
      ALTER TABLE player_seasons 
      ADD COLUMN IF NOT EXISTS base_points INTEGER DEFAULT 0
    `;
    console.log('✅ Added base_points column');
    
    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_base_points 
      ON player_seasons(base_points)
    `;
    console.log('✅ Created index');
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
