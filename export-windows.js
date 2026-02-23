const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const db = neon(process.env.FANTASY_DATABASE_URL);

db`SELECT window_id, window_name, created_at FROM transfer_windows ORDER BY created_at`
    .then(data => {
        fs.writeFileSync('all_windows.json', JSON.stringify(data, null, 2));
        process.exit(0);
    });
