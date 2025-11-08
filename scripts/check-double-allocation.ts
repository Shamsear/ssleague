import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function checkDoubleAllocation() {
  // Get rounds
  const rounds = await sql`
    SELECT id, position, round_number, status
    FROM rounds
    WHERE season_id = 'SSPSLS16'
    ORDER BY round_number
  `;
  
  console.log(`Rounds: ${rounds.length}\n`);
  rounds.forEach(r => {
    console.log(`  Round ${r.round_number} (${r.id}): ${r.position} - ${r.status}`);
  });
  
  // Get LWF round
  const lwfRound = rounds.find(r => r.position === 'LWF');
  if (!lwfRound) {
    console.log('\nNo LWF round found');
    return;
  }
  
  console.log(`\nChecking LWF round ${lwfRound.id}...`);
  
  // Get allocations for this round
  const allocations = await sql`
    SELECT team_id, player_id, purchase_price
    FROM team_players
    WHERE round_id = ${lwfRound.id}
    ORDER BY team_id
  `;
  
  console.log(`\nTotal allocations: ${allocations.length}`);
  
  // Group by team
  const byTeam = new Map<string, any[]>();
  allocations.forEach(a => {
    if (!byTeam.has(a.team_id)) {
      byTeam.set(a.team_id, []);
    }
    byTeam.get(a.team_id)!.push(a);
  });
  
  console.log(`\nAllocations per team:`);
  byTeam.forEach((players, teamId) => {
    console.log(`  ${teamId}: ${players.length} players`);
    if (players.length > 1) {
      console.log(`    ❌ DUPLICATE ALLOCATION!`);
      players.forEach(p => {
        console.log(`      - Player ${p.player_id}: £${p.purchase_price}`);
      });
    }
  });
  
  // Check if any player was allocated twice
  const playerCounts = new Map<number, number>();
  allocations.forEach(a => {
    playerCounts.set(a.player_id, (playerCounts.get(a.player_id) || 0) + 1);
  });
  
  const duplicatePlayers = Array.from(playerCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicatePlayers.length > 0) {
    console.log(`\n⚠️ Players allocated multiple times:`);
    duplicatePlayers.forEach(([playerId, count]) => {
      console.log(`  Player ${playerId}: ${count} times`);
    });
  }
}

checkDoubleAllocation().then(() => process.exit(0));
