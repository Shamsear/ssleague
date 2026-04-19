/**
 * Make all players in footballplayers table eligible for auction
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function makeAllPlayersEligible() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        MAKE ALL PLAYERS ELIGIBLE FOR AUCTION              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check current status
    console.log('STEP 1: Check current eligibility status\n');
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_auction_eligible = true) as eligible,
        COUNT(*) FILTER (WHERE is_auction_eligible = false OR is_auction_eligible IS NULL) as not_eligible
      FROM footballplayers
    `;

    console.log(`Total players: ${stats[0].total}`);
    console.log(`Currently eligible: ${stats[0].eligible}`);
    console.log(`Not eligible: ${stats[0].not_eligible}\n`);

    if (stats[0].not_eligible === 0) {
      console.log('✅ All players are already eligible!\n');
      return;
    }

    // Update all players to be eligible
    console.log('STEP 2: Updating all players to be eligible...\n');

    const result = await sql`
      UPDATE footballplayers
      SET is_auction_eligible = true
      WHERE is_auction_eligible = false OR is_auction_eligible IS NULL
      RETURNING id, name, player_id
    `;

    console.log(`✅ Updated ${result.length} players to be eligible for auction\n`);

    // Verify
    console.log('STEP 3: Verify update\n');

    const verifyStats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_auction_eligible = true) as eligible,
        COUNT(*) FILTER (WHERE is_auction_eligible = false OR is_auction_eligible IS NULL) as not_eligible
      FROM footballplayers
    `;

    console.log(`Total players: ${verifyStats[0].total}`);
    console.log(`Eligible: ${verifyStats[0].eligible}`);
    console.log(`Not eligible: ${verifyStats[0].not_eligible}\n`);

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ All players are now eligible for auction!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

makeAllPlayersEligible()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
