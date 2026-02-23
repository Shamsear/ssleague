const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTeamChanges() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    let output = '';

    const columns = await fantasyDb`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'supported_team_changes'
    ORDER BY ordinal_position
  `;
    output += '--- Columns in supported_team_changes ---\n';
    columns.forEach(c => output += `${c.column_name}: ${c.data_type}\n`);

    fs.writeFileSync('team_changes_schema.txt', output);
}

checkTeamChanges().catch(err => fs.writeFileSync('team_changes_schema.txt', err.stack));
