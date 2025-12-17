/**
 * Check tournament rewards in Neon database
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkTournamentRewards() {
  try {
    console.log('🔍 Checking tournaments table...\n');
    
    // Get all tournaments (without rewards column first)
    const tournaments = await sql`
      SELECT id, tournament_name
      FROM tournaments
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    console.log(`Found ${tournaments.length} tournaments:\n`);
    
    tournaments.forEach(tournament => {
      console.log(`📋 ${tournament.tournament_name} (${tournament.id})`);
    });
    
    // Check if rewards column exists
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tournaments'
      ORDER BY ordinal_position
    `;
    
    console.log('\n📊 Tournaments table columns:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    const hasRewardsColumn = columns.some(col => col.column_name === 'rewards');
    console.log(`\n✅ Rewards column exists: ${hasRewardsColumn}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTournamentRewards();
