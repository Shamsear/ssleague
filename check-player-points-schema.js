const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkPlayerPoints() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    let output = '';

    const columns = await fantasyDb`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_player_points'
    ORDER BY ordinal_position
  `;
    output += '--- Columns in fantasy_player_points ---\n';
    columns.forEach(c => output += `${c.column_name}: ${c.data_type}\n`);

    fs.writeFileSync('player_points_schema.txt', output);
}

checkPlayerPoints().catch(err => fs.writeFileSync('player_points_schema.txt', err.stack));
