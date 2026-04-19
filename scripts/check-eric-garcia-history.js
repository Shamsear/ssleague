require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function check() {
  const history = await sql`
    SELECT 
      player_name,
      team_name,
      season_id,
      contract_start_season,
      contract_end_season,
      acquisition_value,
      status,
      end_date
    FROM player_history
    WHERE player_name = 'Eric García'
  `;

  console.log('\nEric García history:');
  history.forEach(h => {
    console.log(`  ${h.team_name} - Season: ${h.season_id}`);
    console.log(`    Contract: ${h.contract_start_season} → ${h.contract_end_season}`);
    console.log(`    Value: ${h.acquisition_value}, Status: ${h.status}`);
    if (h.end_date) console.log(`    Ended: ${h.end_date}`);
    console.log('');
  });

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
