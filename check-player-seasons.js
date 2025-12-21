const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM player_seasons WHERE season_id = 'SSPSLS16'`;
    console.log('✅ player_seasons count for SSPSLS16:', result[0].count);
    
    const sample = await sql`SELECT player_id, player_name, star_rating FROM player_seasons WHERE season_id = 'SSPSLS16' LIMIT 3`;
    console.log('\nSample players:');
    sample.forEach(p => console.log(`  ${p.player_name} - ${p.star_rating}⭐`));
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
})();
