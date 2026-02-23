require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const db = neon(process.env.NEON_TOURNAMENT_DB_URL);
db`SELECT MAX(round_number) as max_round FROM fixtures WHERE tournament_id = 'SSPSLS16L'`.then(console.log);
