import { getTournamentDb } from '../lib/neon/tournament-config.js';

async function checkUnsoldPlayers() {
    const sql = getTournamentDb();

    console.log('Checking unsold/free agent players structure...\n');

    const unsold = await sql`
    SELECT 
      player_id, 
      player_name, 
      team_id, 
      team,
      season_id, 
      contract_start_season, 
      contract_end_season, 
      auction_value,
      registration_status
    FROM player_seasons 
    WHERE team_id IS NULL 
    LIMIT 10
  `;

    console.log('Unsold/Free Agent Players:');
    console.log(JSON.stringify(unsold, null, 2));

    process.exit(0);
}

checkUnsoldPlayers().catch(console.error);
