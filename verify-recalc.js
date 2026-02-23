const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function verify() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const team = await db`
    SELECT team_id, team_name, player_points, passive_points, total_points, rank
    FROM fantasy_teams
    WHERE team_id = 'SSPSLT0010'
  `;
    console.log('Team Result:', team[0]);

    const passiveBreakdown = await db`
    SELECT round_number, real_team_id, real_team_name, total_bonus
    FROM fantasy_team_bonus_points
    WHERE team_id = 'SSPSLT0010'
    ORDER BY round_number
  `;
    fs.writeFileSync('verify_passive.json', JSON.stringify(passiveBreakdown, null, 2));

    const topTeams = await db`
    SELECT team_name, total_points, rank
    FROM fantasy_teams
    ORDER BY rank
    LIMIT 5
  `;
    console.log('Top 5 Teams:', topTeams);
}

verify().catch(console.error);
