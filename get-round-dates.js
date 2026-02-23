const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function getRoundDates() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);
    const data = await db`
    SELECT round_number, MIN(scheduled_date) as start_date, MAX(scheduled_date) as end_date 
    FROM fixtures 
    GROUP BY round_number 
    ORDER BY round_number
  `;
    fs.writeFileSync('round_dates.json', JSON.stringify(data, null, 2));
}

getRoundDates().catch(err => fs.writeFileSync('round_dates.json', err.stack));
