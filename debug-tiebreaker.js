const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function debugTiebreaker() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  try {
    // Get the latest tiebreaker
    const tiebreakers = await sql`
      SELECT * FROM bulk_tiebreakers 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (tiebreakers.length === 0) {
      console.log('❌ No tiebreakers found');
      return;
    }
    
    const tb = tiebreakers[0];
    console.log('\n📋 Tiebreaker Info:');
    console.log(`   ID: ${tb.id}`);
    console.log(`   Player: ${tb.player_name}`);
    console.log(`   Status: ${tb.status}`);
    console.log(`   Current Highest Bid: £${tb.current_highest_bid}`);
    console.log(`   Current Highest Team: ${tb.current_highest_team_id}`);
    
    // Get teams in this tiebreaker
    const teams = await sql`
      SELECT * FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tb.id}
      ORDER BY current_bid DESC
    `;
    
    console.log(`\n👥 Teams (${teams.length}):`);
    teams.forEach(t => {
      console.log(`   ${t.team_id}: £${t.current_bid || 0} (status: ${t.status})`);
    });
    
    // Get bid history
    const bids = await sql`
      SELECT * FROM bulk_tiebreaker_bids
      WHERE tiebreaker_id = ${tb.id}
      ORDER BY bid_time DESC
      LIMIT 10
    `;
    
    console.log(`\n📊 Recent Bids (${bids.length}):`);
    bids.forEach(b => {
      console.log(`   ${b.team_id}: £${b.bid_amount} at ${new Date(b.bid_time).toLocaleTimeString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugTiebreaker();
