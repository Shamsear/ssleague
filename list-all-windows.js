require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const db = neon(process.env.FANTASY_DATABASE_URL);

db`SELECT window_id, window_name, created_at, opens_at, closes_at FROM transfer_windows ORDER BY created_at`
    .then(data => {
        data.forEach(w => console.log(`${w.window_id} | ${w.window_name} | ${w.created_at}`));
        process.exit(0);
    });
