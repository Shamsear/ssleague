const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkRoundPlayers(roundId = 'SSPSLFBR00010') {
  console.log(`Checking players sold in round ${roundId}...\n`);
  
  const players = await sql`
    SELECT 
      player_id, 
      player_name, 
      position, 
      winning_team_id, 
      winning_bid, 
      status,
      bid_count
    FROM round_players 
    WHERE round_id = ${roundId} 
    AND status = 'sold'
  `;
  
  console.log(`Found ${players.length} sold players:\n`);
  console.log(JSON.stringify(players, null, 2));
  
  // Check if transactions exist for these players
  if (players.length > 0) {
    console.log('\n\nChecking Firebase transactions...');
    console.log('(You need to check Firebase manually for transactions)');
    console.log('\nPlayers to check:');
    players.forEach(p => {
      console.log(`- ${p.player_name} (${p.player_id}) → ${p.winning_team_id} for £${p.winning_bid}`);
    });
  }
}

checkRoundPlayers().catch(console.error);
