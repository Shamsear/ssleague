// Check what status the bids actually have
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkBidStatus() {
  try {
    const roundId = 'a17899a5-8b0a-4c9d-9c81-9935f3a787d3';
    
    console.log(`Checking bid statuses for round ${roundId}...\n`);
    
    const bids = await sql`
      SELECT 
        b.id,
        b.player_id,
        b.amount,
        b.status
      FROM bids b
      WHERE b.round_id = ${roundId}
      ORDER BY b.amount DESC
    `;
    
    console.log(`Found ${bids.length} bids:\n`);
    
    const statusCounts = {};
    bids.forEach(bid => {
      statusCounts[bid.status] = (statusCounts[bid.status] || 0) + 1;
      console.log(`- Player ${bid.player_id}: £${bid.amount} - Status: "${bid.status}"`);
    });
    
    console.log('\nStatus breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  "${status}": ${count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkBidStatus();
