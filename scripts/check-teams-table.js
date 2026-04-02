require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkTeams() {
  // Check distinct season_ids
  const seasons = await sql`SELECT DISTINCT season_id FROM teams ORDER BY season_id`;
  console.log('Seasons in teams table:', seasons.map(s => s.season_id));
  
  // Check sample teams
  const sampleTeams = await sql`SELECT id, name, season_id FROM teams LIMIT 10`;
  console.log('\nSample teams:');
  sampleTeams.forEach(t => console.log(`  ${t.id} - ${t.name} (${t.season_id})`));
}

checkTeams().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
