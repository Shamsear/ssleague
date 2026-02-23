require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugPeriods() {
    const db = neon(process.env.FANTASY_DATABASE_URL);

    const tid = 'SSPSLT0020';
    const squad = await db`SELECT * FROM fantasy_squad WHERE team_id = ${tid}`;
    const transfers = await db`SELECT * FROM fantasy_transfers ORDER BY transferred_at DESC`;

    const playerStates = new Map();
    const initPlayer = (id) => { if (!playerStates.has(id)) playerStates.set(id, new Array(5).fill(null)); };

    for (const s of squad) {
        initPlayer(s.real_player_id);
        playerStates.get(s.real_player_id)[4] = s.team_id;
    }

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
            if (t.player_in_id && playerStates.has(t.player_in_id)) {
                playerStates.get(t.player_in_id)[p - 1] = null;
                console.log(`P${p - 1}: ${t.player_in_id} JOINED In at ${t.window_id}`);
            }
            if (t.player_out_id) {
                initPlayer(t.player_out_id);
                playerStates.get(t.player_out_id)[p - 1] = t.team_id;
                console.log(`P${p - 1}: ${t.player_out_id} WAS HERE at ${t.window_id}`);
            }
        }
    }

    for (const [pid, states] of playerStates.entries()) {
        console.log(`PID: ${pid} -> ${JSON.stringify(states)}`);
    }
}
debugPeriods().catch(console.error);
