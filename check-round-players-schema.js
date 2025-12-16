const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'round_players' 
      ORDER BY ordinal_position
    `;
    
    console.log('round_players table columns:');
    console.log(JSON.stringify(columns, null, 2));
    
    // Also check a sample row
    const sample = await sql`SELECT * FROM round_players LIMIT 1`;
    console.log('\nSample row:');
    console.log(JSON.stringify(sample, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
