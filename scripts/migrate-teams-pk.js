const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  console.log('🔄 Starting migration: Change teams primary key to composite (id, season_id)...\n');
  
  try {
    // Step 1: Drop existing primary key
    console.log('Step 1: Dropping existing primary key...');
    await sql`ALTER TABLE teams DROP CONSTRAINT teams_pkey`;
    console.log('✅ Dropped teams_pkey\n');
    
    // Step 2: Add composite primary key
    console.log('Step 2: Adding composite primary key (id, season_id)...');
    await sql`ALTER TABLE teams ADD PRIMARY KEY (id, season_id)`;
    console.log('✅ Added composite primary key\n');
    
    // Step 3: Create index on id
    console.log('Step 3: Creating index on id...');
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_id ON teams(id)`;
    console.log('✅ Created idx_teams_id\n');
    
    // Step 4: Create index on season_id
    console.log('Step 4: Creating index on season_id...');
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams(season_id)`;
    console.log('✅ Created idx_teams_season_id\n');
    
    // Verify
    console.log('Verifying new primary key...');
    const pk = await sql`
      SELECT constraint_name, column_name, ordinal_position
      FROM information_schema.key_column_usage 
      WHERE table_name = 'teams' AND constraint_name LIKE '%pkey%'
      ORDER BY ordinal_position
    `;
    
    console.log('\n✅ Migration complete! New primary key:');
    pk.forEach(col => {
      console.log(`   - ${col.column_name} (position ${col.ordinal_position})`);
    });
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
