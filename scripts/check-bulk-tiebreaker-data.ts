import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

(async () => {
  console.log('\n🔍 Checking bulk_tiebreakers table data...\n');

  const tiebreaker = await sql`
    SELECT * FROM bulk_tiebreakers WHERE id = 'SSPSLTR00001'
  `;

  if (tiebreaker.length === 0) {
    console.log('❌ Tiebreaker not found');
    process.exit(1);
  }

  const tb = tiebreaker[0];
  
  console.log('Tiebreaker Data:');
  console.log('================');
  console.log(`ID: ${tb.id}`);
  console.log(`Player: ${tb.player_name} (${tb.player_position})`);
  console.log(`Status: ${tb.status}`);
  console.log(`Current Highest Bid: £${tb.current_highest_bid}`);
  console.log(`Current Highest Team: ${tb.current_highest_team_id}`);
  console.log(`Start Time: ${tb.start_time}`);
  console.log(`Last Activity: ${tb.last_activity_time}`);
  console.log(`Created: ${tb.created_at}`);
  console.log(`Resolved: ${tb.resolved_at}`);

  console.log('\n📊 Team Bids:');
  console.log('================');
  
  const teams = await sql`
    SELECT * FROM bulk_tiebreaker_teams 
    WHERE tiebreaker_id = 'SSPSLTR00001'
    ORDER BY current_bid DESC
  `;

  teams.forEach(team => {
    console.log(`${team.team_name}: £${team.current_bid} (${team.status})`);
  });

  console.log('\n📝 Bid History:');
  console.log('================');
  
  const bids = await sql`
    SELECT * FROM bulk_tiebreaker_bids 
    WHERE tiebreaker_id = 'SSPSLTR00001'
    ORDER BY bid_time DESC
    LIMIT 10
  `;

  if (bids.length === 0) {
    console.log('⚠️  No bid history found');
  } else {
    bids.forEach(bid => {
      console.log(`${bid.team_name}: £${bid.bid_amount} at ${bid.bid_time}`);
    });
  }

  // Check if data needs updating
  console.log('\n🔧 Issues Found:');
  console.log('================');
  
  if (!tb.start_time) {
    console.log('❌ start_time is null');
  }
  if (!tb.last_activity_time) {
    console.log('❌ last_activity_time is null');
  }
  if (!tb.current_highest_bid || tb.current_highest_bid === 0) {
    console.log('❌ current_highest_bid is 0 or null');
  }
  if (!tb.current_highest_team_id) {
    console.log('❌ current_highest_team_id is null');
  }

  console.log('\n');
})();
