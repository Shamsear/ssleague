const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debug() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  const data = await fantasyDb`
    SELECT 
      fpp.round_number, 
      fpp.fixture_id,
      fpp.fantasy_round_id
    FROM fantasy_player_points fpp
    LIMIT 100
  `;
  fs.writeFileSync('fpp_sample.json', JSON.stringify(data, null, 2));

  // Check if we can find tournament info for these fixtures in tournament DB
  const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const fixtureIds = [...new Set(data.map(d => d.fixture_id))];

  if (fixtureIds.length > 0) {
    const fixtures = await tournamentDb`
      SELECT id, tournament_id, round_number 
      FROM fixtures 
      WHERE id IN (${fixtureIds})
    `;
    fs.writeFileSync('fixtures_info.json', JSON.stringify(fixtures, null, 2));
  }
}

debug().catch(err => fs.writeFileSync('debug_error.txt', err.stack));
