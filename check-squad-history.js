const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSquadHistory() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    let output = '';

    const squad = await fantasyDb`
    SELECT real_player_id, player_name, team_id, acquisition_type, acquired_at 
    FROM fantasy_squad 
    LIMIT 20
  `;
    output += '--- Fantasy Squad (Current) ---\n';
    output += JSON.stringify(squad, null, 2);

    fs.writeFileSync('squad_history.txt', output);
}

checkSquadHistory().catch(err => fs.writeFileSync('squad_history.txt', err.stack));
