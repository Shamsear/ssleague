require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Debugging tiebreakers...\n');
    
    // Get active tiebreakers
    console.log('=== Active Tiebreakers ===');
    const tiebreakers = await sql`
      SELECT t.id, t.round_id, t.player_id, t.status, t.season_id, r.round_type
      FROM tiebreakers t
      LEFT JOIN rounds r ON t.round_id = r.id
      WHERE t.status = 'active'
      ORDER BY t.created_at DESC
      LIMIT 10
    `;
    console.log(`Found ${tiebreakers.length} active tiebreaker(s):`);
    tiebreakers.forEach((t, i) => {
      console.log(`  ${i + 1}. ID: ${t.id}, Round: ${t.round_id}, Player: ${t.player_id}, Round Type: ${t.round_type || 'NULL'}`);
    });
    
    if (tiebreakers.length > 0) {
      const firstTiebreaker = tiebreakers[0];
      console.log(`\n=== Team Tiebreakers for Tiebreaker ${firstTiebreaker.id} ===`);
      const teamTiebreakers = await sql`
        SELECT tt.id, tt.team_id, tt.tiebreaker_id, tt.old_bid_amount, tt.new_bid_amount, tt.submitted
        FROM team_tiebreakers tt
        WHERE tt.tiebreaker_id = ${firstTiebreaker.id}
      `;
      console.log(`Found ${teamTiebreakers.length} team(s) in this tiebreaker:`);
      teamTiebreakers.forEach((tt, i) => {
        console.log(`  ${i + 1}. Team ID: ${tt.team_id}, Old Bid: ${tt.old_bid_amount}, New Bid: ${tt.new_bid_amount || 'NULL'}, Submitted: ${tt.submitted}`);
      });
    }
    
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e);
  }
})();
