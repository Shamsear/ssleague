/**
 * Check if Kopites exists in teams table
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkTeams() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         CHECK TEAMS TABLE                                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const kopites = await sql`
      SELECT id, name, season_id
      FROM teams
      WHERE id = 'SSPSLT0023'
    `;
    
    console.log(`Kopites (SSPSLT0023): ${kopites.length} records`);
    if (kopites.length > 0) {
      kopites.forEach(t => {
        console.log(`   - ${t.name}, Season: ${t.season_id}`);
      });
    }
    
    const asgardians = await sql`
      SELECT id, name, season_id
      FROM teams
      WHERE id = 'SSPSLT0005'
    `;
    
    console.log(`\nTM Asgardians (SSPSLT0005): ${asgardians.length} records`);
    if (asgardians.length > 0) {
      asgardians.forEach(t => {
        console.log(`   - ${t.name}, Season: ${t.season_id}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

checkTeams()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
