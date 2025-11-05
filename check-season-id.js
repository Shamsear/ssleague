require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

(async () => {
  try {
    const tb = await sql`SELECT id, season_id, round_id, status FROM tiebreakers WHERE id = 'SSPSLTR00003'`;
    console.log('Tiebreaker:', JSON.stringify(tb[0], null, 2));
    
    const round = await sql`SELECT id, season_id FROM rounds WHERE id = 'SSPSLFR00002'`;
    console.log('\nRound:', JSON.stringify(round[0], null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
