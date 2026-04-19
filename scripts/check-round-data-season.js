/**
 * Check which season the round_players and round_bids belong to
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

const TEAM_ID = 'SSPSLT0023';

async function checkRoundData() {
  console.log('\n🔍 Checking Round Players and Round Bids by Season...\n');

  try {
    // Check round_players with season info
    const roundPlayersWithSeason = await sql`
      SELECT 
        rp.id,
        rp.player_name,
        rp.winning_team_id,
        rp.winning_bid,
        r.season_id,
        r.round_number,
        r.position
      FROM round_players rp
      JOIN rounds r ON rp.round_id = r.id
      WHERE rp.winning_team_id = ${TEAM_ID}
      ORDER BY r.season_id, r.round_number
    `;

    console.log('📊 ROUND PLAYERS:\n');
    console.log(`Total: ${roundPlayersWithSeason.length} records\n`);

    // Group by season
    const bySeasonPlayers = {};
    roundPlayersWithSeason.forEach(rp => {
      if (!bySeasonPlayers[rp.season_id]) {
        bySeasonPlayers[rp.season_id] = [];
      }
      bySeasonPlayers[rp.season_id].push(rp);
    });

    Object.entries(bySeasonPlayers).forEach(([seasonId, players]) => {
      console.log(`Season ${seasonId}: ${players.length} players`);
      players.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.player_name} - Round ${p.round_number} (${p.position}) - ${p.winning_bid} eCoin`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('Error checking round_players:', error.message);
  }

  try {
    // Check round_bids with season info
    const roundBidsWithSeason = await sql`
      SELECT 
        rb.id,
        rb.player_id,
        rb.team_id,
        rb.team_name,
        rb.bid_amount,
        rb.is_winning,
        r.season_id,
        r.round_number
      FROM round_bids rb
      JOIN rounds r ON rb.round_id = r.id
      WHERE rb.team_id = ${TEAM_ID}
      ORDER BY r.season_id, r.round_number, rb.bid_amount DESC
    `;

    console.log('📊 ROUND BIDS:\n');
    console.log(`Total: ${roundBidsWithSeason.length} bids\n`);

    // Group by season
    const bySeasonBids = {};
    roundBidsWithSeason.forEach(rb => {
      if (!bySeasonBids[rb.season_id]) {
        bySeasonBids[rb.season_id] = [];
      }
      bySeasonBids[rb.season_id].push(rb);
    });

    Object.entries(bySeasonBids).forEach(([seasonId, bids]) => {
      const totalBidAmount = bids.reduce((sum, b) => sum + (b.bid_amount || 0), 0);
      const winningBids = bids.filter(b => b.is_winning).length;
      
      console.log(`Season ${seasonId}: ${bids.length} bids (${totalBidAmount} eCoin total, ${winningBids} winning)`);
      bids.forEach((b, i) => {
        const status = b.is_winning ? '✓ WON' : '✗ Lost';
        console.log(`  ${i + 1}. Round ${b.round_number} - ${b.bid_amount} eCoin ${status}`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('Error checking round_bids:', error.message);
  }

  console.log('✅ Check complete!\n');
}

checkRoundData().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
