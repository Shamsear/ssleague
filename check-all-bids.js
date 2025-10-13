// Check all bids and their player IDs
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkAllBids() {
  try {
    console.log('Checking all bids...\n');
    
    // Get all bids
    const bids = await sql`
      SELECT 
        b.id,
        b.team_id,
        b.player_id,
        b.round_id,
        b.amount,
        b.status,
        b.created_at
      FROM bids b
      ORDER BY b.created_at DESC
      LIMIT 20
    `;
    
    console.log(`Total recent bids: ${bids.length}\n`);
    
    if (bids.length > 0) {
      console.log('Sample bids:\n');
      bids.slice(0, 5).forEach(bid => {
        console.log(`- Bid ${bid.id.substring(0, 8)}`);
        console.log(`  Round: ${bid.round_id}`);
        console.log(`  Team: ${bid.team_id}`);
        console.log(`  Player ID: ${bid.player_id}`);
        console.log(`  Amount: £${bid.amount?.toLocaleString()}`);
        console.log(`  Status: ${bid.status}`);
        console.log('');
      });
    }
    
    // Check footballplayers table structure
    console.log('\n---\nChecking footballplayers sample:\n');
    const players = await sql`
      SELECT id, name, position
      FROM footballplayers
      LIMIT 5
    `;
    
    console.log(`Sample footballplayers:\n`);
    players.forEach(p => {
      console.log(`- ID: ${p.id} | Name: ${p.name} | Position: ${p.position}`);
    });
    
    // Check all rounds
    console.log('\n---\nAll rounds:\n');
    const rounds = await sql`
      SELECT id, position, status, created_at
      FROM rounds
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    rounds.forEach(r => {
      console.log(`- Round ${r.id}`);
      console.log(`  Position: ${r.position} | Status: ${r.status}`);
      console.log(`  Created: ${r.created_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkAllBids();
