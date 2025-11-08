import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function checkBids() {
  // Get latest round
  const latestRound = await sql`
    SELECT id, round_number, status
    FROM rounds
    WHERE season_id = 'SSPSLS16'
    ORDER BY round_number DESC
    LIMIT 1
  `;
  
  if (latestRound.length === 0) {
    console.log('No rounds found');
    return;
  }
  
  const roundId = latestRound[0].id;
  console.log(`Latest Round: ${roundId} (Round ${latestRound[0].round_number}, Status: ${latestRound[0].status})\n`);
  
  // Check if Manchester United submitted
  const submission = await sql`
    SELECT team_id
    FROM bid_submissions
    WHERE round_id = ${roundId}
    AND team_id = 'SSPSLT0002'
  `;
  
  console.log(`Manchester United submission: ${submission.length > 0 ? 'YES' : 'NO'}`);
  
  // Check if they had any bids
  const bids = await sql`
    SELECT id, player_id, status
    FROM bids
    WHERE round_id = ${roundId}
    AND team_id = 'SSPSLT0002'
  `;
  
  console.log(`Manchester United bids: ${bids.length}`);
  
  // Get all teams that got players
  const allocations = await sql`
    SELECT team_id, player_id, purchase_price
    FROM team_players
    WHERE round_id = ${roundId}
    ORDER BY team_id
  `;
  
  console.log(`\nTotal allocations: ${allocations.length}`);
  console.log('\nTeams that got players:');
  allocations.forEach(a => {
    console.log(`  - ${a.team_id}: Player ${a.player_id} for £${a.purchase_price}`);
  });
  
  // Check if Man United is in the list
  const manUnitedGotPlayer = allocations.some(a => a.team_id === 'SSPSLT0002');
  console.log(`\nManchester United got player: ${manUnitedGotPlayer ? 'YES' : 'NO'}`);
}

checkBids().then(() => process.exit(0));
