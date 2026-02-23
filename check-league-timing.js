const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkLeagueRounds() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const rounds = await db`
    SELECT round_number, tournament_id, MAX(played_date) as last_played, MAX(scheduled_date) as last_scheduled
    FROM fixtures 
    WHERE tournament_id = 'SSPSLS16L' 
    GROUP BY round_number, tournament_id
    ORDER BY round_number
  `;
    fs.writeFileSync('league_round_dates.json', JSON.stringify(rounds, null, 2));

    const otherTours = await db`
    SELECT tournament_id, MIN(played_date) as start_played, MIN(scheduled_date) as start_scheduled
    FROM fixtures
    WHERE tournament_id != 'SSPSLS16L'
    GROUP BY tournament_id
  `;
    fs.writeFileSync('other_tours_start.json', JSON.stringify(otherTours, null, 2));
}

checkLeagueRounds().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
