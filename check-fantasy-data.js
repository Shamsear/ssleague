const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFantasyRounds() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const rounds = await db`SELECT * FROM fantasy_rounds ORDER BY round_number`;
    fs.writeFileSync('fantasy_rounds_data.json', JSON.stringify(rounds, null, 2));

    const transfers = await db`SELECT * FROM fantasy_transfers LIMIT 20`;
    fs.writeFileSync('fantasy_transfers_sample.json', JSON.stringify(transfers, null, 2));
}

checkFantasyRounds().catch(err => fs.writeFileSync('fantasy_error.txt', err.stack));
