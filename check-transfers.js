const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTransfers() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    let output = '';

    const columns = await fantasyDb`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_transfers'
    ORDER BY ordinal_position
  `;
    output += '--- Columns in fantasy_transfers ---\n';
    columns.forEach(c => output += `${c.column_name}: ${c.data_type}\n`);

    const recent = await fantasyDb`SELECT * FROM fantasy_transfers LIMIT 5`;
    output += '\n--- Recent Transfers ---\n';
    output += JSON.stringify(recent, null, 2);

    fs.writeFileSync('transfer_info.txt', output);
}

checkTransfers().catch(err => fs.writeFileSync('transfer_info.txt', err.stack));
