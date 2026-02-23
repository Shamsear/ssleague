const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkFantasyRounds() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    let output = '';

    const columns = await fantasyDb`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_rounds'
    ORDER BY ordinal_position
  `;
    output += '--- Columns in fantasy_rounds ---\n';
    columns.forEach(c => output += `${c.column_name}: ${c.data_type}\n`);

    fs.writeFileSync('fantasy_rounds_schema.txt', output);
}

checkFantasyRounds().catch(err => fs.writeFileSync('fantasy_rounds_schema.txt', err.stack));
