require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const fpp = await db`
    SELECT player_name, round_number, fixture_id, total_points 
    FROM fantasy_player_points 
    WHERE team_id = 'SSPSLT0020' 
    ORDER BY player_name, round_number
  `;
    console.log(`TOTAL RECORDS FOR SKILL 555: ${fpp.length}`);

    const players = [...new Set(fpp.map(r => r.player_name))];
    for (const p of players) {
        const pfpp = fpp.filter(r => r.player_name === p);
        console.log(`Player: ${p} (${pfpp.length} records)`);
        console.log(`Rounds covered: ${pfpp.map(r => r.round_number).join(', ')}`);
    }
}
debugSkill555().catch(console.error);
