require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSquad() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const tdb = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = 'SSPSLT0020'`;

    if (squad.length > 0) {
        const ids = squad.map(s => s.real_player_id);
        for (const id of ids) {
            const count = await tdb`SELECT count(*) FROM matchups WHERE home_player_id = ${id} OR away_player_id = ${id}`;
            console.log(`Player ${id}: Match Count =`, count[0].count);
        }
    }

    const fppCount = await db`SELECT count(*) FROM fantasy_player_points WHERE team_id = 'SSPSLT0020'`;
    console.log('Skill 555 FPP Records Count:', fppCount[0].count);
}
debugSquad().catch(console.error);
