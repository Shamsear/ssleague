const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkSchema() {
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'matchups' 
      ORDER BY ordinal_position
    `;
    
    console.log('matchups table columns:');
    console.log(JSON.stringify(columns, null, 2));
    
    const sample = await sql`SELECT * FROM matchups LIMIT 2`;
    console.log('\nSample rows:');
    console.log(JSON.stringify(sample, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
