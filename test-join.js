// Test the JOIN query that finalization uses
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function testJoin() {
  try {
    // Use the active round ID
    const roundId = 'a17899a5-8b0a-4c9d-9c81-9935f3a787d3';
    
    console.log(`Testing JOIN query for round ${roundId}...\n`);
    
    // Test the exact query from finalization
    const bidsResult = await sql`
      SELECT 
        b.id,
        b.team_id,
        t.name as team_name,
        b.player_id,
        p.name as player_name,
        b.amount,
        b.round_id
      FROM bids b
      JOIN teams t ON b.team_id = t.id
      JOIN footballplayers p ON b.player_id = p.id::text
      WHERE b.round_id = ${roundId}
      AND b.status = 'active'
      ORDER BY b.amount DESC
    `;
    
    console.log(`✅ Query successful! Found ${bidsResult.length} bids\n`);
    
    if (bidsResult.length > 0) {
      console.log('Bids with player info:\n');
      bidsResult.forEach(bid => {
        console.log(`- ${bid.player_name} (${bid.player_id})`);
        console.log(`  Team: ${bid.team_name}`);
        console.log(`  Amount: £${bid.amount?.toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No active bids found\n');
      
      // Check if bids exist at all
      const allBids = await sql`
        SELECT COUNT(*) as count
        FROM bids
        WHERE round_id = ${roundId}
      `;
      console.log(`Total bids for this round (any status): ${allBids[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testJoin();
