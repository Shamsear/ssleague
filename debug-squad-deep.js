require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSquad() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const tdb = neon(process.env.NEON_TOURNAMENT_DB_URL);

    // 1. Get Skill 555 squad again to be sure
    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = 'SSPSLT0020'`;
    console.log('Skill 555 Squad (re-check):', squad);

    // 2. Check if these IDs even exist in player_seasons or matchups
    if (squad.length > 0) {
        const ids = squad.map(s => s.real_player_id);
        const matchups = await tdb`
      SELECT home_player_id, away_player_id, count(*) 
      FROM matchups 
      WHERE home_player_id IN (${ids}) OR away_player_id IN (${ids})
      GROUP BY home_player_id, away_player_id
    `;
        console.log('Matchups for these players:', matchups);
    }

    // 3. See who is actually scoring points in the system
    const topScorers = await db`
    SELECT real_player_id, player_name, SUM(total_points) as pts 
    FROM fantasy_player_points 
    GROUP BY real_player_id, player_name 
    ORDER BY pts DESC 
    LIMIT 10
  `;
    console.log('Top Scorers in FPP:', topScorers);
}
debugSquad().catch(console.error);
