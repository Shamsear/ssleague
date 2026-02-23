const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    // 1. Find the team ID for 'Skill 555'
    const team = await db`
    SELECT team_id, team_name 
    FROM fantasy_teams 
    WHERE team_name ILIKE '%Skill 555%'
  `;
    console.log('Team Found:', team);
    if (team.length === 0) return;
    const tid = team[0].team_id;

    // 2. Get the squad for this team
    const squad = await db`
    SELECT real_player_id, player_name, total_points 
    FROM fantasy_squad 
    WHERE team_id = ${tid}
  `;
    console.log('Squad:', squad);

    // 3. Get the calculated points records for each player in this team
    const points = await db`
    SELECT real_player_id, player_name, fixture_id, round_number, total_points
    FROM fantasy_player_points
    WHERE team_id = ${tid}
    ORDER BY round_number
  `;
    fs.writeFileSync('debug_skill_555_points.json', JSON.stringify(points, null, 2));

    // 4. Check if there are transfers for this team
    const transfers = await db`
    SELECT * 
    FROM fantasy_transfers 
    WHERE team_id = ${tid}
    ORDER BY transferred_at DESC
  `;
    console.log('Transfers:', transfers);
}

debugSkill555().catch(console.error);
