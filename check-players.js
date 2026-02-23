require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const db = neon(process.env.FANTASY_DATABASE_URL);

async function checkMultipleTeams() {
  const pids = ['sspslpsl0078', 'sspslpsl0020', 'sspslpsl0063', 'sspslpsl0002'];
  const res = await db`SELECT real_player_id, team_id, player_name FROM fantasy_squad WHERE real_player_id IN (${pids})`;
  console.log('Player Ownerships:', res);
}
checkMultipleTeams();
