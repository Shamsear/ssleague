const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

async function searchGimenez() {
  const result = await sql`
    SELECT 
      tp.player_id,
      fp.name,
      fp.player_id as fp_player_id,
      fp.team_id,
      fp.status,
      fp.is_sold,
      fp.acquisition_value
    FROM team_players tp
    JOIN footballplayers fp ON tp.player_id = fp.id
    WHERE tp.team_id = 'SSPSLT0005'
      AND fp.name ILIKE '%GIMENEZ%'
  `;
  
  console.log(JSON.stringify(result, null, 2));
}

searchGimenez();
