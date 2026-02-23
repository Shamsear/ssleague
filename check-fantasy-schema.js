const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkSchema() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    let output = '';

    const squadColumns = await fantasyDb`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_squad'
    ORDER BY ordinal_position
  `;
    output += '--- Columns in fantasy_squad ---\n';
    squadColumns.forEach(c => output += `${c.column_name}: ${c.data_type}\n`);

    const leagues = await fantasyDb`
    SELECT id, league_id, season_id, is_active FROM fantasy_leagues
  `;
    output += '\n--- Leagues ---\n';
    leagues.forEach(l => output += `${l.league_id} (${l.season_id}) - Active: ${l.is_active}\n`);

    const teamBonusColumns = await fantasyDb`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_team_bonus_points'
    ORDER BY ordinal_position
  `;
    output += '\n--- Columns in fantasy_team_bonus_points ---\n';
    teamBonusColumns.forEach(c => output += `${c.column_name}: ${c.data_type}\n`);

    fs.writeFileSync('schema_info.txt', output);
}

checkSchema().catch(err => fs.writeFileSync('schema_info.txt', err.stack));
