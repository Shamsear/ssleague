require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function getPlayerIds() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  const players = [
    { name: 'RAHUL KL', points: 120 },
    { name: 'Safar', points: 145 },
    { name: 'Anu Anshin', points: 202 },
    { name: 'Hyder', points: 174 },
    { name: 'Shamsear', points: 170 },
    { name: 'Umar', points: 215 },
    { name: 'Abid Rizwan', points: 206 },
    { name: 'SIRAJ', points: 205 },
    { name: 'Amjad', points: 205 },
  ];

  console.log('Finding player IDs...\n');

  for (const p of players) {
    const result = await sql`
      SELECT player_id, player_name, points, star_rating, auction_value, team
      FROM player_seasons
      WHERE season_id = 'SSPSLS16'
        AND player_name ILIKE ${`%${p.name}%`}
        AND points = ${p.points}
    `;

    if (result.length > 0) {
      const player = result[0];
      console.log(`{ player_id: '${player.player_id}', name: '${player.player_name}', currentStar: ${player.star_rating}, points: ${player.points}, team: '${player.team || 'Unknown'}', auctionValue: ${player.auction_value || 0} },`);
    } else {
      console.log(`NOT FOUND: ${p.name} (${p.points} points)`);
    }
  }
}

getPlayerIds();
