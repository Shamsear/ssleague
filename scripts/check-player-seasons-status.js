require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkPlayerSeasons() {
  console.log('\nChecking player_seasons for both teams...\n');
  
  // Check Kopites
  const kopites = await sql`
    SELECT season_id, status, COUNT(*) as count
    FROM player_seasons
    WHERE team_id = 'SSPSLT0023'
    GROUP BY season_id, status
    ORDER BY season_id, status
  `;
  
  console.log('Kopites (SSPSLT0023):');
  kopites.forEach(r => {
    console.log(`  ${r.season_id} - ${r.status}: ${r.count} players`);
  });
  
  // Check TM Asgardians
  const asgardians = await sql`
    SELECT season_id, status, COUNT(*) as count
    FROM player_seasons
    WHERE team_id = 'SSPSLT0005'
    GROUP BY season_id, status
    ORDER BY season_id, status
  `;
  
  console.log('\nTM Asgardians (SSPSLT0005):');
  asgardians.forEach(r => {
    console.log(`  ${r.season_id} - ${r.status}: ${r.count} players`);
  });
  
  // Check if there are any S16 Kopites records
  const kopitesS16 = await sql`
    SELECT player_name, category, star_rating, contract_start_season, contract_end_season
    FROM player_seasons
    WHERE team_id = 'SSPSLT0023'
    AND season_id = 'SSPSLS16'
    LIMIT 10
  `;
  
  console.log('\nSample Kopites S16 players:');
  kopitesS16.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.player_name} (${p.category}) - ${p.star_rating}⭐`);
    console.log(`     Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
  });
}

checkPlayerSeasons().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
