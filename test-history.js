require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testHistory() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

    const squad = await fantasyDb`
    SELECT real_player_id, team_id, acquired_at, acquisition_type, player_name, league_id
    FROM fantasy_squad
  `;
    const transfers = await fantasyDb`
    SELECT team_id, player_out_id, player_out_name, player_in_id, player_in_name, transferred_at, league_id
    FROM fantasy_transfers
    ORDER BY transferred_at DESC
  `;

    // Map<playerId, Array<{teamId, from, to, leagueId}>>
    const playerHistory = new Map();

    // Initialize with current squad
    for (const s of squad) {
        if (!playerHistory.has(s.real_player_id)) playerHistory.set(s.real_player_id, []);
        playerHistory.get(s.real_player_id).push({
            team_id: s.team_id,
            league_id: s.league_id,
            from: new Date(s.acquired_at),
            to: new Date('2099-12-31'),
            player_name: s.player_name,
            status: 'current'
        });
    }

    // Work backwards through transfers to reconstruct previous tenures
    // Note: This is tricky. A transfer in team T: [Out: P_out, In: P_in] at Time T.
    // It means P_in started at T. P_out ended at T.

    for (const t of transfers) {
        const time = new Date(t.transferred_at);

        // 1. Handle player_in: they JOINED team_id at 'time'
        // If they are currently in the squad (or was in it later), we already have an entry starting at 'time'.
        // We should ensure that entry exists.

        // 2. Handle player_out: they LEFT team_id at 'time'
        // They must have joined earlier. We'll create a tenure for them [?, time]
        // How do we know when они joined? 
        // We search for a previous transfer where they were player_in to this same team.
        // If no such transfer exists, they must have been drafted.

        if (t.player_out_id) {
            if (!playerHistory.has(t.player_out_id)) playerHistory.set(t.player_out_id, []);
            const histories = playerHistory.get(t.player_out_id);

            // Check if we already have an entry for this player in this team ending at or starting from a later time
            // For a player_out, we are saying "they were in team_id and left at 'time'"
            histories.push({
                team_id: t.team_id,
                league_id: t.league_id,
                from: null, // We'll fill this later or assume draft start
                to: time,
                player_name: t.player_out_name,
                status: 'historical'
            });
        }
    }

    // Final pass: sort tenures and fill 'from' dates
    // For 'from' dates that are null, they must be from the start of the season (Draft)
    const SEASON_START = new Date('2025-01-01'); // Adjust as needed

    for (const [playerId, histories] of playerHistory.entries()) {
        // Sort by 'to' date
        histories.sort((a, b) => a.to - b.to);

        for (let i = 0; i < histories.length; i++) {
            if (histories[i].from === null) {
                // Find if there was a previous entry? No, if we are going backwards, we'd have the 'in' transfer.
                // If No 'transfer in' exists for this tenure, it started at draft.
                histories[i].from = SEASON_START;
            }
        }
    }

    console.log('--- Reconstructed History (Sample) ---');
    const samplePlayer = 'sspslpsl0063'; // Adil Mubarak
    console.log(`History for ${samplePlayer}`, JSON.stringify(playerHistory.get(samplePlayer), null, 2));
}

testHistory();
