const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkAcquisitionHistory() {
  console.log('Checking acquisition history for sample football players...\n');
  console.log('='.repeat(80));
  
  // Check a few sample players
  const samplePlayers = [
    { name: 'Leon Bailey', id: '115118' },
    { name: 'Pedro Porro', id: '119828' },
    { name: 'Kim Min-Jae', id: '122460' }
  ];
  
  for (const player of samplePlayers) {
    console.log(`\n${player.name} (${player.id}):`);
    
    // Check bids table for any season
    const bids = await sql`
      SELECT season_id, round_id, amount, actual_bid_amount, status, team_name
      FROM bids
      WHERE player_id = ${player.id}
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log(`  Bids found: ${bids.length}`);
    if (bids.length > 0) {
      bids.forEach(b => {
        console.log(`    - Season: ${b.season_id}, Round: ${b.round_id}, Amount: ${b.actual_bid_amount || b.amount}, Status: ${b.status}, Team: ${b.team_name}`);
      });
    }
    
    // Check footballplayers table for acquisition_value
    const fpData = await sql`
      SELECT season_id, team_name, acquisition_value, status
      FROM footballplayers
      WHERE player_id = ${player.id}
      ORDER BY season_id DESC
      LIMIT 5
    `;
    
    console.log(`  Football players records: ${fpData.length}`);
    if (fpData.length > 0) {
      fpData.forEach(fp => {
        console.log(`    - Season: ${fp.season_id || 'NULL'}, Team: ${fp.team_name}, Acquisition: ${fp.acquisition_value || 'NULL'}, Status: ${fp.status}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\nChecking if there are ANY football player bids in SSPSLS16...\n');
  
  const anyBids = await sql`
    SELECT COUNT(*) as count
    FROM bids
    WHERE season_id = 'SSPSLS16'
      AND status = 'won'
  `;
  
  console.log(`Total won bids in SSPSLS16: ${anyBids[0].count}`);
  
  // Sample some won bids
  const sampleBids = await sql`
    SELECT player_id, team_name, amount, actual_bid_amount, round_id
    FROM bids
    WHERE season_id = 'SSPSLS16'
      AND status = 'won'
    LIMIT 10
  `;
  
  console.log('\nSample won bids from SSPSLS16:');
  sampleBids.forEach(b => {
    console.log(`  Player: ${b.player_id}, Team: ${b.team_name}, Amount: ${b.actual_bid_amount || b.amount}, Round: ${b.round_id}`);
  });
  
  process.exit(0);
}

checkAcquisitionHistory().catch(err => {
  console.error(err);
  process.exit(1);
});
