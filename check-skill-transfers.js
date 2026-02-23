require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugTransfers() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const pids = ['sspslpsl0078', 'sspslpsl0020', 'sspslpsl0063', 'sspslpsl0002', 'sspslpsl0042'];
    const res = await db`SELECT * FROM fantasy_transfers WHERE player_in_id IN (${pids}) OR player_out_id IN (${pids}) ORDER BY transferred_at DESC`;
    console.log('Transfers for Skill 555 Players:', res);
}
debugTransfers();
