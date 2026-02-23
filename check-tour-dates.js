const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkDates() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const data = await db`
    SELECT tournament_id, MIN(played_date) as start_played, MAX(played_date) as end_played,
           MIN(scheduled_date) as start_sched, MAX(scheduled_date) as end_sched
    FROM fixtures 
    GROUP BY tournament_id
  `;
    fs.writeFileSync('tour_dates.json', JSON.stringify(data, null, 2));
}

checkDates().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
