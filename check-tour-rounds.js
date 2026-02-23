const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFixtures() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const data = await db`
    SELECT tournament_id, round_number, count(*) as count
    FROM fixtures 
    WHERE status = 'completed'
    GROUP BY tournament_id, round_number
    ORDER BY round_number, tournament_id
  `;
    fs.writeFileSync('fixtures_by_tour_round.json', JSON.stringify(data, null, 2));
}

checkFixtures().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
