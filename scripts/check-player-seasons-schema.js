require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name='player_seasons' 
    ORDER BY ordinal_position
  `;
  
  console.log('player_seasons columns:');
  console.table(columns);
}

checkSchema();
