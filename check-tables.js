const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTables() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    const tables = await fantasyDb`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
    fs.writeFileSync('tables_list.txt', tables.map(t => t.table_name).join('\n'));
}

checkTables().catch(err => fs.writeFileSync('tables_list.txt', err.stack));
