require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const tdb = neon(process.env.NEON_TOURNAMENT_DB_URL);

    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = 'SSPSLT0020'`;

    for (const s of squad) {
        console.log(`\nAnalyzing Player: ${s.player_name} (${s.real_player_id})`);

        // Check points records for this player regardless of team_id
        const fppAll = await db`SELECT team_id, round_number, fixture_id, total_points FROM fantasy_player_points WHERE real_player_id = ${s.real_player_id} ORDER BY round_number`;
        console.log(`  - Total FPP records in system: ${fppAll.length}`);
        if (fppAll.length > 0) {
            const teams = [...new Set(fppAll.map(r => r.team_id))];
            console.log(`  - Point records owned by teams: ${teams.join(', ')}`);
            fppAll.slice(0, 5).forEach(r => console.log(`    - R${r.round_number} (${r.fixture_id}) for Team ${r.team_id}: ${r.total_points} pts`));
        }
    }
}
debugSkill555().catch(console.error);
