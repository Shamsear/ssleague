const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function check() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);
    const data = await db`
    SELECT round_number, count(*) as count, status 
    FROM fixtures 
    GROUP BY round_number, status 
    ORDER BY round_number
  `;
    fs.writeFileSync('fixtures_status.json', JSON.stringify(data, null, 2));
}

check().catch(err => fs.writeFileSync('fixtures_status.json', err.stack));
