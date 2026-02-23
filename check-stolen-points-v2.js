require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = 'SSPSLT0020'`;

    for (const s of squad) {
        console.log(`\n=================================================`);
        console.log(`Analyzing Player: ${s.player_name} (${s.real_player_id})`);

        const fppAll = await db`SELECT team_id, round_number, fixture_id, total_points FROM fantasy_player_points WHERE real_player_id = ${s.real_player_id} ORDER BY round_number`;
        console.log(`Total FPP records: ${fppAll.length}`);

        // Group by team
        const byTeam = {};
        fppAll.forEach(r => {
            if (!byTeam[r.team_id]) byTeam[r.team_id] = [];
            byTeam[r.team_id].push(r);
        });

        for (const tid in byTeam) {
            console.log(`  Team ${tid}: ${byTeam[tid].length} records`);
            console.log(`    Rounds: ${byTeam[tid].map(r => r.round_number).join(', ')}`);
        }
    }
}
debugSkill555().catch(console.error);
