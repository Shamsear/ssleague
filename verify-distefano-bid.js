const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function verifyBid() {
  console.log('Verifying Filippo Distefano bid...\n');
  console.log('='.repeat(80));
  
  const bids = await sql`
    SELECT b.*, f.name as player_name
    FROM bids b
    JOIN footballplayers f ON b.player_id = f.id
    WHERE f.name = 'Filippo Distefano'
    AND b.season_id = 'SSPSLS16'
  `;
  
  if (bids.length === 0) {
    console.log('❌ No bid found for Filippo Distefano');
    process.exit(1);
  }
  
  const bid = bids[0];
  
  console.log('\n✅ Bid found:');
  console.log(`   Bid ID: ${bid.id}`);
  console.log(`   Player: ${bid.player_name} (${bid.player_id})`);
  console.log(`   Team: ${bid.team_name} (${bid.team_id})`);
  console.log(`   Amount: ${bid.amount}`);
  console.log(`   Actual Bid Amount: ${bid.actual_bid_amount}`);
  console.log(`   Status: ${bid.status}`);
  console.log(`   Phase: ${bid.phase}`);
  console.log(`   Round: ${bid.round_id}`);
  console.log(`   Season: ${bid.season_id}`);
  console.log(`   Created: ${bid.created_at}`);
  console.log(`   Submitted: ${bid.submitted_at}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Verification complete!');
  
  process.exit(0);
}

verifyBid().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
