const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkOtherTourDates() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const data = await db`
    SELECT round_number, tournament_id, MIN(updated_at) as first_updated, MAX(updated_at) as last_updated
    FROM fixtures 
    WHERE tournament_id != 'SSPSLS16L' 
    GROUP BY round_number, tournament_id
    ORDER BY tournament_id, round_number
  `;
    fs.writeFileSync('other_fixture_dates.json', JSON.stringify(data, null, 2));
}

checkOtherTourDates().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
