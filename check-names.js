require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const tdb = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = 'SSPSLT0020'`;
    console.log('Skill 555 Current Squad:', squad.map(s => `${s.player_name} (${s.real_player_id})`));

    for (const s of squad) {
        const ps = await tdb`SELECT * FROM player_seasons WHERE player_id = ${s.real_player_id}`;
        if (ps.length === 0) {
            console.log(`!!! Player ${s.player_name} (${s.real_player_id}) NOT FOUND in player_seasons !!!`);
        } else {
            console.log(`Player ${s.player_name} (${s.real_player_id}) found in player_seasons as: ${ps[0].player_name}`);
        }

        const matches = await tdb`
        SELECT m.fixture_id, f.round_number, f.tournament_id, m.home_player_id, m.away_player_id
        FROM matchups m JOIN fixtures f ON m.fixture_id = f.id
        WHERE m.home_player_id = ${s.real_player_id} OR m.away_player_id = ${s.real_player_id}
        LIMIT 5
    `;
        console.log(`Player ${s.player_name} Match Sample Count:`, matches.length);
        matches.forEach(m => {
            const side = m.home_player_id === s.real_player_id ? 'HOME' : 'AWAY';
            console.log(`  - ${side} in ${m.fixture_id} (R${m.round_number} ${m.tournament_id})`);
        });
    }
}
debugSkill555().catch(console.error);
