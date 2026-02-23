require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugSkill555Calculations() {
    const db = neon(process.env.FANTASY_DATABASE_URL);
    const lid = 'SSPSLFLS16';
    const tid = 'SSPSLT0020';

    // Fetch squad as of ROLLBACK
    // Reproduce PERIOD_MAPPING and state rollback for Skill 555
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

    // Debug states for Skill 555 players specifically
    const skill555Players = [];
    for (const [pid, states] of playerStates.entries()) {
        if (states.includes(tid)) {
            skill555Players.push({ pid, states });
            console.log(`Player ${pid} belonged to Skill 555 in periods:`, states.map((s, i) => s === tid ? i : null).filter(x => x !== null));
        }
    }

    // Find fixtures in those periods
    const tdb = neon(process.env.NEON_TOURNAMENT_DB_URL);
    const matchups = await tdb`
    SELECT m.fixture_id, f.round_number, f.tournament_id, m.home_player_id, m.away_player_id 
    FROM matchups m JOIN fixtures f ON m.fixture_id = f.id
    WHERE f.status = 'completed'
  `;

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

    const actualPoints = await db`SELECT real_player_id, count(*) as count, sum(total_points) as pts FROM fantasy_player_points WHERE team_id = ${tid} GROUP BY real_player_id`;
    console.log('Actual Points stored for Skill 555:', actualPoints);

    // Check expected fixtures for each Skill 555 player
    for (const p of skill555Players) {
        const expectedMatchups = matchups.filter(m => {
            const period = getPeriod(m);
            return (m.home_player_id === p.pid || m.away_player_id === p.pid) && p.states[period] === tid;
        });
        console.log(`Player ${p.pid} expected to score in ${expectedMatchups.length} fixtures for Skill 555`);
        if (expectedMatchups.length > 0) {
            console.log(`Sample fixture for ${p.pid}: ${expectedMatchups[0].fixture_id} (R${expectedMatchups[0].round_number})`);
        }
    }
}
debugSkill555Calculations().catch(console.error);
