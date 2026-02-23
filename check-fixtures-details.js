const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFixtures() {
    const db = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const columns = await db`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fixtures'
    ORDER BY ordinal_position
  `;
    fs.writeFileSync('fixtures_schema.txt', columns.map(c => `${c.column_name}: ${c.data_type}`).join('\n'));

    const sample = await db`SELECT * FROM fixtures WHERE status = 'completed' LIMIT 5`;
    fs.writeFileSync('fixtures_sample.json', JSON.stringify(sample, null, 2));
}

checkFixtures().catch(err => fs.writeFileSync('fixtures_error.txt', err.stack));
