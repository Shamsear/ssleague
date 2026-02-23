require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugAllTransfers() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const res = await db`SELECT team_id, window_id, player_out_id, player_in_id, player_out_name, player_in_name FROM fantasy_transfers`;
    console.log('ALL TRANSFERS:', res);
}
debugAllTransfers();
