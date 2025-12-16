require('dotenv').config({ path: '.env.local' });
const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.FANTASY_DATABASE_URL });
  
  console.log('🚀 Running fantasy_team_bonus_points table migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create_fantasy_team_bonus_points_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Created fantasy_team_bonus_points table');
    console.log('   - Created indexes for performance');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
