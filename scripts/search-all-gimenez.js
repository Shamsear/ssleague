const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

async function searchAllGimenez() {
  console.log('Searching footballplayers table for GIMENEZ...\n');
  
  const result = await sql`
    SELECT 
      id,
      player_id,
      name,
      team_id,
      status,
      is_sold,
      acquisition_value,
      position
    FROM footballplayers
    WHERE name ILIKE '%GIMENEZ%'
    ORDER BY name
  `;
  
  console.log(`Found ${result.length} player(s):\n`);
  result.forEach(p => {
    console.log(`Name: ${p.name}`);
    console.log(`ID: ${p.id}`);
    console.log(`Player ID: ${p.player_id}`);
    console.log(`Team: ${p.team_id || 'NULL (free agent)'}`);
    console.log(`Status: ${p.status || 'NULL'}`);
    console.log(`Is Sold: ${p.is_sold}`);
    console.log(`Position: ${p.position}`);
    console.log('---\n');
  });
}

searchAllGimenez();
