/**
 * Manually trigger auto-population of lineups for teams with 5 players
 * Run this after the lineup deadline has passed
 */

require('dotenv').config({ path: '.env.local' });

const SEASON_ID = 'SSPSLS16';
const ROUND_NUMBER = 1; // Change this to the current round
const LEG = 'first';

async function autoPopulateLineups() {
  console.log('🤖 Triggering auto-populate lineups...\n');
  console.log(`Season: ${SEASON_ID}`);
  console.log(`Round: ${ROUND_NUMBER}`);
  console.log(`Leg: ${LEG}\n`);

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/lineups/auto-populate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: SEASON_ID,
        round_number: ROUND_NUMBER,
        leg: LEG
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ ${data.message}\n`);
      
      if (data.details && data.details.length > 0) {
        console.log('📋 Details:\n');
        data.details.forEach((detail, index) => {
          console.log(`${index + 1}. ${detail.team} (${detail.player_count} players)`);
          console.log(`   Action: ${detail.action}`);
          console.log(`   Fixture: ${detail.fixture_id}\n`);
        });
      }

      console.log(`\n📊 Summary:`);
      console.log(`   Auto-populated: ${data.auto_populated} team(s)`);
      console.log(`   Total checked: ${data.details?.length || 0} team(s)`);
    } else {
      console.error('❌ Error:', data.error);
    }

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

autoPopulateLineups()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
