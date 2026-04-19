require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkPlayerHistory() {
  // Check a specific player across seasons
  const player = await sql`
    SELECT id, player_id, name, team_id, team_name, season_id, acquisition_value, is_sold
    FROM footballplayers 
    WHERE name = 'Ollie Watkins'
    LIMIT 5
  `;
  
  console.log('Ollie Watkins records:');
  console.log(JSON.stringify(player, null, 2));
  
  // Check how many players have season_id = SSPSLS17
  const s17Count = await sql`
    SELECT COUNT(*) as total
    FROM footballplayers 
    WHERE season_id = 'SSPSLS17'
  `;
  
  console.log('\nTotal players in Season 17:', s17Count[0].total);
  
  // Check how many players have season_id = SSPSLS16
  const s16Count = await sql`
    SELECT COUNT(*) as total
    FROM footballplayers 
    WHERE season_id = 'SSPSLS16'
  `;
  
  console.log('Total players in Season 16:', s16Count[0].total);
}

checkPlayerHistory().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
