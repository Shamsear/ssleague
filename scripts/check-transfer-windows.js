require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkData() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('=== TRANSFER WINDOWS ===');
  const windows = await fantasyDb`
    SELECT * 
    FROM transfer_windows 
    LIMIT 5
  `;
  console.log(JSON.stringify(windows, null, 2));

  console.log('\n=== TRANSFERS BY WINDOW ===');
  const transfers = await fantasyDb`
    SELECT window_id, COUNT(*) as count 
    FROM fantasy_transfers 
    GROUP BY window_id 
    ORDER BY count DESC
  `;
  console.log(JSON.stringify(transfers, null, 2));

  console.log('\n=== TOURNAMENTS ===');
  const tournaments = await tournamentDb`
    SELECT tournament_id, COUNT(*) as fixture_count, MAX(round_number) as max_round 
    FROM fixtures 
    WHERE status = 'completed'
    GROUP BY tournament_id 
    ORDER BY tournament_id
  `;
  console.log(JSON.stringify(tournaments, null, 2));

  console.log('\n=== FIXTURE ROUND DISTRIBUTION ===');
  const roundDist = await tournamentDb`
    SELECT tournament_id, round_number, COUNT(*) as fixture_count 
    FROM fixtures 
    WHERE status = 'completed'
    GROUP BY tournament_id, round_number 
    ORDER BY round_number, tournament_id
  `;
  console.log(JSON.stringify(roundDist, null, 2));

  process.exit(0);
}

checkData();
