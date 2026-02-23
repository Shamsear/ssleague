const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFixtureDates() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const data = await db`
    SELECT round_number, tournament_id, MAX(updated_at) as last_updated, MAX(matchups_created_at) as last_created
    FROM fixtures 
    WHERE tournament_id = 'SSPSLS16L' 
    GROUP BY round_number, tournament_id
    ORDER BY round_number
  `;
    fs.writeFileSync('fixture_system_dates.json', JSON.stringify(data, null, 2));
}

checkFixtureDates().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
