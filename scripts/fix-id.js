require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function fixId() {
  const result = await sql`
    UPDATE realplayerstats 
    SET id = 'sspslpsl0012_SSPSLS13' 
    WHERE id = 'sspslpsl0165_SSPSLS13'
  `;
  console.log('✅ Fixed id column:', result);
}

fixId();
