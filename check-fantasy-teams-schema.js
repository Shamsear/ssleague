require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
  
  console.log('🔍 Checking fantasy_teams schema...\n');
  
  try {
    const teams = await fantasyDb`
      SELECT * FROM fantasy_teams WHERE league_id = 'SSPSLFLS16' LIMIT 1
    `;
    
    if (teams.length > 0) {
      console.log('Sample team record:');
      console.log(JSON.stringify(teams[0], null, 2));
      console.log('\nColumns:', Object.keys(teams[0]));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
