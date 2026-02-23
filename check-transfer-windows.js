const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTransfers() {
  const db = neon(process.env.FANTASY_DATABASE_URL);

  const windows = await db`
    SELECT window_id, window_name, opens_at, closes_at
    FROM transfer_windows 
    WHERE window_id IN ('tw_SSPSLFLS16_1766410531769', 'tw_SSPSLFLS16_1767458224465', 'stw_SSPSLFLS16_1767471253796')
  `;
  fs.writeFileSync('window_details.json', JSON.stringify(windows, null, 2));

  // Check the counts of transfers per window
  const counts = await db`
    SELECT window_id, count(*) as count, MIN(transferred_at) as first, MAX(transferred_at) as last
    FROM fantasy_transfers
    GROUP BY window_id
  `;
  fs.writeFileSync('transfer_counts.json', JSON.stringify(counts, null, 2));
}

checkTransfers().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
