require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

(async () => {
  try {
    console.log('🔧 Fixing tiebreakers with null season_id...\n');
    
    // Find tiebreakers with null season_id
    const nullSeasonTiebreakers = await sql`
      SELECT t.id, t.round_id, r.season_id
      FROM tiebreakers t
      INNER JOIN rounds r ON t.round_id = r.id
      WHERE t.season_id IS NULL
    `;
    
    console.log(`Found ${nullSeasonTiebreakers.length} tiebreaker(s) with null season_id`);
    
    if (nullSeasonTiebreakers.length === 0) {
      console.log('✅ No tiebreakers need fixing!');
      return;
    }
    
    // Update each tiebreaker
    for (const tb of nullSeasonTiebreakers) {
      console.log(`  Updating tiebreaker ${tb.id}: setting season_id to ${tb.season_id}`);
      await sql`
        UPDATE tiebreakers
        SET season_id = ${tb.season_id}
        WHERE id = ${tb.id}
      `;
    }
    
    console.log(`\n✅ Fixed ${nullSeasonTiebreakers.length} tiebreaker(s)!`);
    
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e);
  }
})();
