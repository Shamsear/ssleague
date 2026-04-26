const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.DATABASE_URL);

async function checkClubField() {
  const playerId = process.argv[2] || '162163';
  
  const results = await sql`
    SELECT player_id, name, team_name, team_id
    FROM footballplayers 
    WHERE player_id = ${playerId}
  `;
  
  console.log('\nPlayer data:');
  console.log(JSON.stringify(results, null, 2));
}

checkClubField().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
