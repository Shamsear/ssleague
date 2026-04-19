const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkRoundPlayers() {
  console.log('Checking round SSPSLFR00004 players...\n');
  console.log('='.repeat(80));
  
  // Check if there's a round_players table
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%round%'
  `;
  
  console.log('Tables with "round" in name:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));
  
  // Check bids for this round
  console.log('\n\nBids in round SSPSLFR00004:');
  const bids = await sql`
    SELECT b.id, b.player_id, f.name as player_name, b.team_name, b.status, b.phase
    FROM bids b
    LEFT JOIN footballplayers f ON b.player_id = f.id
    WHERE b.round_id = 'SSPSLFR00004'
    ORDER BY b.created_at
    LIMIT 10
  `;
  
  console.log(`\nFound ${bids.length} bids:`);
  bids.forEach(b => {
    console.log(`  - ${b.player_name || 'Unknown'} (${b.player_id}) - ${b.team_name} - ${b.status} - ${b.phase || 'regular'}`);
  });
  
  process.exit(0);
}

checkRoundPlayers().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
