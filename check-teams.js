const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkTeams() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  try {
    // Get teams table schema
    const schema = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'teams'
      ORDER BY ordinal_position
    `;
    
    console.log('📊 Teams table columns:');
    schema.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    // Get a sample team
    const teams = await sql`SELECT * FROM teams LIMIT 1`;
    if (teams.length > 0) {
      console.log('\n📋 Sample team:');
      console.log(teams[0]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTeams();
