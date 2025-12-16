require('dotenv').config({ path: '.env.local' });
const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.NEON_TOURNAMENT_DB_URL });
  
  console.log('🚀 Running lineup submission tracking migration...\n');
  
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_lineup_submission_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added lineup submission timestamp columns');
    console.log('   - Created team_violations table');
    
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
