require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const { Pool } = require('@neondatabase/serverless');
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('============================================================');
    console.log('Tournament Rewards Migration');
    console.log('============================================================');
    console.log('Connecting to database...');
    
    const client = await pool.connect();
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create_tournaments_table.sql');
    console.log(`Reading migration file: ${migrationPath}`);
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  - Created tournaments table with all columns');
    console.log('  - Added \'rewards\' JSONB column for tournament rewards');
    console.log('  - Added \'number_of_teams\' INTEGER column');
    console.log('  - Created indexes for performance');
    console.log('  - Added column comments');
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
