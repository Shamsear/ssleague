/**
 * Test player_history query to see what data exists
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function testQuery() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         TEST PLAYER_HISTORY QUERY                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Test 1: Kopites S17
    console.log('1️⃣  KOPITES S17 (SSPSLT0023)\n');
    
    const kopitesS17 = await sql`
      SELECT *
      FROM player_history
      WHERE team_id = 'SSPSLT0023'
      AND season_id = 'SSPSLS17'
    `;
    
    console.log(`Found ${kopitesS17.length} records\n`);
    
    if (kopitesS17.length > 0) {
      kopitesS17.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.player_name} (${p.position})`);
        console.log(`      Status: ${p.status}`);
        console.log(`      Value: ${p.acquisition_value}`);
        console.log(`      Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
      });
      if (kopitesS17.length > 3) {
        console.log(`   ... and ${kopitesS17.length - 3} more`);
      }
    }

    // Test 2: TM Asgardians S17
    console.log('\n\n2️⃣  TM ASGARDIANS S17 (SSPSLT0005)\n');
    
    const asgardiansS17 = await sql`
      SELECT *
      FROM player_history
      WHERE team_id = 'SSPSLT0005'
      AND season_id = 'SSPSLS17'
    `;
    
    console.log(`Found ${asgardiansS17.length} records\n`);
    
    if (asgardiansS17.length > 0) {
      asgardiansS17.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.player_name} (${p.position})`);
        console.log(`      Status: ${p.status}`);
        console.log(`      Value: ${p.acquisition_value}`);
        console.log(`      Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
      });
      if (asgardiansS17.length > 3) {
        console.log(`   ... and ${asgardiansS17.length - 3} more`);
      }
    }

    // Test 3: Check footballplayers table
    console.log('\n\n3️⃣  FOOTBALLPLAYERS TABLE\n');
    
    const kopitesFootball = await sql`
      SELECT COUNT(*) as count
      FROM footballplayers
      WHERE team_id = 'SSPSLT0023'
      AND season_id = 'SSPSLS17'
    `;
    
    const asgardiansFootball = await sql`
      SELECT COUNT(*) as count
      FROM footballplayers
      WHERE team_id = 'SSPSLT0005'
      AND season_id = 'SSPSLS17'
    `;
    
    console.log(`   Kopites S17: ${kopitesFootball[0].count} players`);
    console.log(`   TM Asgardians S17: ${asgardiansFootball[0].count} players\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

testQuery()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
