/**
 * Add rewards column to tournaments table
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function addRewardsColumn() {
  try {
    console.log('🔄 Adding rewards column to tournaments table...\n');
    
    // Add rewards column
    await sql`
      ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT NULL
    `;
    
    console.log('✅ Rewards column added!\n');
    
    // Add number_of_teams column
    await sql`
      ALTER TABLE tournaments
      ADD COLUMN IF NOT EXISTS number_of_teams INTEGER DEFAULT 16
    `;
    
    console.log('✅ Number_of_teams column added!\n');
    
    // Verify
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tournaments' 
      AND column_name IN ('rewards', 'number_of_teams')
    `;
    
    console.log('Verified columns:');
    columns.forEach(col => {
      console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

addRewardsColumn();
