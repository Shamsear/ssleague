// Check bid statuses for the completed round
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkBids() {
  try {
    const roundId = '95304aff-6cbe-44a3-bfc1-70b971dee4ba';
    
    console.log(`Checking bids for round ${roundId}...\n`);
    
    // Get all bids for this round
    const bids = await sql`
      SELECT 
        b.id,
        b.team_id,
        b.player_id,
        b.amount,
        b.status,
        b.created_at,
        b.updated_at
      FROM bids b
      WHERE b.round_id = ${roundId}
      ORDER BY b.amount DESC
    `;
    
    console.log(`Total bids found: ${bids.length}\n`);
    
    if (bids.length === 0) {
      console.log('⚠️  No bids found for this round!\n');
    } else {
      console.log('Bids breakdown by status:\n');
      
      const statusCounts = {};
      bids.forEach(bid => {
        statusCounts[bid.status] = (statusCounts[bid.status] || 0) + 1;
      });
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      
      console.log('\nAll bids:\n');
      bids.forEach(bid => {
        console.log(`- Bid ${bid.id.substring(0, 8)}`);
        console.log(`  Team: ${bid.team_id}`);
        console.log(`  Player: ${bid.player_id}`);
        console.log(`  Amount: £${bid.amount?.toLocaleString()}`);
        console.log(`  Status: ${bid.status}`);
        console.log(`  Created: ${bid.created_at}`);
        console.log(`  Updated: ${bid.updated_at}`);
        console.log('');
      });
    }
    
    // Check round status
    console.log('\n---\nRound details:\n');
    const round = await sql`
      SELECT * FROM rounds WHERE id = ${roundId}
    `;
    
    if (round.length > 0) {
      console.log(`Position: ${round[0].position}`);
      console.log(`Status: ${round[0].status}`);
      console.log(`Max bids per team: ${round[0].max_bids_per_team}`);
      console.log(`End time: ${round[0].end_time}`);
      console.log(`Created: ${round[0].created_at}`);
      console.log(`Updated: ${round[0].updated_at}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkBids();
