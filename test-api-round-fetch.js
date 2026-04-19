const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function testAPIFetch() {
  console.log('Testing API fetch for round SSPSLFR00004...\n');
  console.log('='.repeat(80));
  
  // Simulate what the API does - fetch bids with player details
  const bids = await sql`
    SELECT 
      b.id,
      b.team_id,
      b.player_id,
      b.round_id,
      b.amount,
      b.actual_bid_amount,
      b.status,
      b.phase,
      b.created_at,
      b.team_name,
      f.name as player_name,
      f.position,
      f.overall_rating
    FROM bids b
    LEFT JOIN footballplayers f ON b.player_id = f.id
    WHERE b.round_id = 'SSPSLFR00004'
    ORDER BY b.created_at DESC
  `;
  
  console.log(`\nFound ${bids.length} bids with player details:\n`);
  
  bids.forEach((b, i) => {
    console.log(`${i + 1}. ${b.player_name || 'NULL'} (ID: ${b.player_id})`);
    console.log(`   Team: ${b.team_name}`);
    console.log(`   Position: ${b.position || 'NULL'}`);
    console.log(`   Rating: ${b.overall_rating || 'NULL'}`);
    console.log(`   Amount: ${b.amount || 'NULL'} / Actual: ${b.actual_bid_amount || 'NULL'}`);
    console.log(`   Status: ${b.status}, Phase: ${b.phase || 'regular'}`);
    console.log('');
  });
  
  // Check specifically for Filippo Distefano
  const distefanoBid = bids.find(b => b.player_id === '2873');
  
  if (distefanoBid) {
    console.log('='.repeat(80));
    console.log('\n✅ Filippo Distefano bid FOUND in results!');
    console.log(JSON.stringify(distefanoBid, null, 2));
  } else {
    console.log('='.repeat(80));
    console.log('\n❌ Filippo Distefano bid NOT FOUND in results');
    
    // Check if the bid exists at all
    const directCheck = await sql`
      SELECT * FROM bids WHERE player_id = '2873'
    `;
    
    if (directCheck.length > 0) {
      console.log('\n⚠️  But the bid EXISTS in the bids table:');
      console.log(JSON.stringify(directCheck[0], null, 2));
    }
  }
  
  process.exit(0);
}

testAPIFetch().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
