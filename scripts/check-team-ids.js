const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const db = neon(process.env.FANTASY_DATABASE_URL);

(async () => {
  const teams = await db`SELECT team_id, team_name FROM fantasy_teams`;
  console.log('Fantasy Teams:');
  teams.forEach(t => console.log(`  ${t.team_id} - ${t.team_name}`));
  
  const bonuses = await db`SELECT target_id, points FROM bonus_points WHERE target_type='team'`;
  console.log('\nBonus Points target_ids:');
  bonuses.forEach(b => console.log(`  ${b.target_id} - ${b.points} pts`));
})().then(() => process.exit(0));
