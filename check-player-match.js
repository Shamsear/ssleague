// Check if player IDs match between bids and footballplayers
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkPlayerMatch() {
  try {
    console.log('Checking player ID matching...\n');
    
    // Get unique player IDs from bids
    const bidPlayers = await sql`
      SELECT DISTINCT player_id
      FROM bids
      ORDER BY player_id
    `;
    
    console.log(`Unique player IDs in bids: ${bidPlayers.length}\n`);
    console.log('Player IDs from bids:', bidPlayers.map(b => b.player_id).join(', '));
    
    // Check if these exist in footballplayers
    console.log('\n---\nChecking if these players exist in footballplayers:\n');
    
    for (const bid of bidPlayers.slice(0, 5)) {
      const playerId = bid.player_id;
      
      // Try as string
      const playerStr = await sql`
        SELECT id, name, position
        FROM footballplayers
        WHERE id::text = ${playerId}
        LIMIT 1
      `;
      
      if (playerStr.length > 0) {
        console.log(`✅ Player ${playerId}: ${playerStr[0].name} (${playerStr[0].position})`);
      } else {
        console.log(`❌ Player ${playerId}: NOT FOUND`);
      }
    }
    
    // Check data types
    console.log('\n---\nChecking data types:\n');
    const typeCheck = await sql`
      SELECT 
        column_name, 
        data_type 
      FROM information_schema.columns 
      WHERE table_name = 'footballplayers' AND column_name = 'id'
    `;
    console.log('footballplayers.id type:', typeCheck[0]?.data_type);
    
    const bidTypeCheck = await sql`
      SELECT 
        column_name, 
        data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bids' AND column_name = 'player_id'
    `;
    console.log('bids.player_id type:', bidTypeCheck[0]?.data_type);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkPlayerMatch();
