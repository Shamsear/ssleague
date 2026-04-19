/**
 * Check footballplayers table for Kopites
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkFootballPlayers() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         CHECK FOOTBALLPLAYERS FOR KOPITES                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check all Kopites records
    console.log('1️⃣  ALL KOPITES RECORDS\n');
    
    const allKopites = await sql`
      SELECT season_id, COUNT(*) as count, SUM(acquisition_value) as total_value
      FROM footballplayers
      WHERE team_id = 'SSPSLT0023'
      GROUP BY season_id
      ORDER BY season_id
    `;
    
    console.log('Kopites footballplayers by season:\n');
    allKopites.forEach(row => {
      console.log(`   ${row.season_id}: ${row.count} players, ${row.total_value} eCoin`);
    });
    
    // Check S16 specifically
    console.log('\n\n2️⃣  KOPITES S16 DETAILS\n');
    
    const s16Players = await sql`
      SELECT name, position, acquisition_value, season_id, is_sold
      FROM footballplayers
      WHERE team_id = 'SSPSLT0023'
      AND season_id = 'SSPSLS16'
      LIMIT 5
    `;
    
    console.log(`Found ${s16Players.length} S16 players:\n`);
    s16Players.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.position}) - ${p.acquisition_value} eCoin`);
      console.log(`      Season: ${p.season_id}, Sold: ${p.is_sold}`);
    });
    
    // Check TM Asgardians
    console.log('\n\n3️⃣  TM ASGARDIANS RECORDS\n');
    
    const asgardians = await sql`
      SELECT season_id, COUNT(*) as count, SUM(acquisition_value) as total_value
      FROM footballplayers
      WHERE team_id = 'SSPSLT0005'
      GROUP BY season_id
      ORDER BY season_id
    `;
    
    console.log('TM Asgardians footballplayers by season:\n');
    asgardians.forEach(row => {
      console.log(`   ${row.season_id}: ${row.count} players, ${row.total_value} eCoin`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

checkFootballPlayers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
