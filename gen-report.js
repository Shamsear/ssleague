require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = 'SSPSLT0020'`;

    const report = [];
    for (const s of squad) {
        const fppAll = await db`SELECT team_id, round_number, fixture_id, total_points FROM fantasy_player_points WHERE real_player_id = ${s.real_player_id} ORDER BY round_number`;

        // Group by team
        const byTeam = {};
        fppAll.forEach(r => {
            if (!byTeam[r.team_id]) byTeam[r.team_id] = [];
            byTeam[r.team_id].push(r);
        });

        let teamStr = '';
        for (const tid in byTeam) {
            teamStr += `  Team ${tid}: ${byTeam[tid].length} records (${byTeam[tid].map(r => r.round_number).join(', ')})\n`;
        }
        report.push(`Player: ${s.player_name} (${s.real_player_id})\nTotal FPP records: ${fppAll.length}\n${teamStr}`);
    }
    require('fs').writeFileSync('final_report.txt', report.join('\n-------------------\n'));
}
debugSkill555().catch(console.error);
