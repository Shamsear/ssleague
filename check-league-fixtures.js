const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFixtures() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const sample = await db`
    SELECT id, tournament_id, round_number, status, scheduled_date, played_date
    FROM fixtures 
    WHERE tournament_id = 'SSPSLS16L' AND round_number IN (7, 13)
  `;
    fs.writeFileSync('league_sample_rounds.json', JSON.stringify(sample, null, 2));

    const allTours = await db`SELECT DISTINCT tournament_id FROM fixtures`;
    fs.writeFileSync('all_tournaments.json', JSON.stringify(allTours, null, 2));
}

checkFixtures().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
