require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const db = neon(process.env.FANTASY_DATABASE_URL);
db`SELECT * FROM transfer_windows`.then(data => {
    data.forEach(w => console.log(`${w.window_id} | ${w.window_name} | ${w.created_at}`));
});
