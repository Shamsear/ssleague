require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555Calculations() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const tid = 'SSPSLT0020';

    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = ${tid}`;
    const transfers = await db`SELECT * FROM fantasy_transfers ORDER BY transferred_at DESC`;

    const playerStates = new Map();
    const initPlayer = (id) => { if (!playerStates.has(id)) playerStates.set(id, new Array(5).fill(null)); };
    for (const s of squad) { initPlayer(s.real_player_id); playerStates.get(s.real_player_id)[4] = s.team_id; }

    const PERIOD_WINDOWS = [
        ['tw_SSPSLFLS16_1766410531769', 'tw_SSPSLFLS16_1766328244409'],
        ['tw_SSPSLFLS16_1767458224465'],
        ['tw_SSPSLFLS16_1768451156004'],
    ];

    for (let p = 4; p > 0; p--) {
        for (const [pid, states] of playerStates.entries()) { states[p - 1] = states[p]; }
        const milestoneWindows = PERIOD_WINDOWS[p - 1] || [];
        const pTransfers = transfers.filter(t => {
            if (p <= 3) return milestoneWindows.includes(t.window_id);
            const allPrev = [].concat(...PERIOD_WINDOWS);
            return !allPrev.includes(t.window_id);
        });
        for (const t of pTransfers) {
            if (t.player_in_id && playerStates.has(t.player_in_id)) playerStates.get(t.player_in_id)[p - 1] = null;
            if (t.player_out_id) { initPlayer(t.player_out_id); playerStates.get(t.player_out_id)[p - 1] = t.team_id; }
        }
    }

    const tdb = neon(process.env.NEON_TOURNAMENT_DB_URL);
    const matchups = await tdb`SELECT m.fixture_id, f.round_number, f.tournament_id, m.home_player_id, m.away_player_id FROM matchups m JOIN fixtures f ON m.fixture_id = f.id WHERE f.status = 'completed'`;

    const getPeriod = (f) => {
        if (f.tournament_id === 'SSPSLS16L') {
            if (f.round_number <= 7) return 0;
            if (f.round_number <= 13) return 1;
            if (f.round_number <= 20) return 2;
            if (f.round_number <= 26) return 3;
            return 4;
        }
        return 4;
    };

    for (const [pid, states] of playerStates.entries()) {
        if (states.includes(tid)) {
            const pExpected = matchups.filter(m => {
                const period = getPeriod(m);
                return (m.home_player_id === pid || m.away_player_id === pid) && states[period] === tid;
            });
            const pActual = await db`SELECT count(*) FROM fantasy_player_points WHERE team_id = ${tid} AND real_player_id = ${pid}`;
            console.log(`Player ${pid}: Expected ${pExpected.length}, Actual ${pActual[0].count} and States: ${JSON.stringify(states)}`);
        }
    }
}
debugSkill555Calculations().catch(console.error);
