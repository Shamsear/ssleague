/**
 * Run migration to add rewards column to tournaments table
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function runMigration() {
  try {
    console.log('🔄 Running tournament rewards migration...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_tournament_rewards.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration using unsafe method for raw SQL
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify the column was added
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tournaments' AND column_name = 'rewards'
    `;
    
    if (columns.length > 0) {
      console.log('✅ Rewards column verified:', columns[0]);
    } else {
      console.log('⚠️  Rewards column not found after migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

runMigration();
