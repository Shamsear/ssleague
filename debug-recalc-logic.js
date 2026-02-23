const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debug() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const changes = await db`SELECT * FROM supported_team_changes`;
    fs.writeFileSync('debug_team_changes.json', JSON.stringify(changes, null, 2));

    const windows = await db`SELECT * FROM transfer_windows`;
    fs.writeFileSync('debug_transfer_windows.json', JSON.stringify(windows, null, 2));
}

debug().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
