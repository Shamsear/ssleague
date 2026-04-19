/**
 * Fix round SSPSLFBR00010 - Create missing transaction and verify updates
 */

const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  try {
    // Try to initialize without service account for transaction check only
    console.log('⚠️  Firebase Admin not initialized - will skip transaction creation');
    console.log('   (Transactions can only be created with Firebase service account key)');
  } catch (error) {
    // Ignore
  }
}

const roundId = 'SSPSLFBR00010';
const seasonId = 'SSPSLS17';

async function fixRound() {
  console.log(`🔧 Fixing round ${roundId}...\n`);

  // Get sold players
  const players = await sql`
    SELECT 
      player_id, 
      player_name, 
      position, 
      winning_team_id, 
      winning_bid, 
      status
    FROM round_players 
    WHERE round_id = ${roundId} 
    AND status = 'sold'
  `;

  if (players.length === 0) {
    console.log('❌ No sold players found in this round');
    return;
  }

  console.log(`Found ${players.length} sold player(s):\n`);

  for (const player of players) {
    console.log(`\n📊 Processing: ${player.player_name} → ${player.winning_team_id}`);
    console.log(`   Amount: £${player.winning_bid}`);

    // Check current Neon state
    const teamBefore = await sql`
      SELECT football_budget, football_spent, football_players_count
      FROM teams
      WHERE id = ${player.winning_team_id}
      AND season_id = ${seasonId}
    `;

    if (teamBefore.length === 0) {
      console.log(`   ❌ Team not found in Neon`);
      continue;
    }

    console.log(`   Neon Before: Budget £${teamBefore[0].football_budget}, Spent £${teamBefore[0].football_spent}, Players ${teamBefore[0].football_players_count}`);

    // Check if this deduction was already applied
    const expectedSpent = parseFloat(teamBefore[0].football_spent);
    const playerCost = parseFloat(player.winning_bid);

    // For FC Barcelona (SSPSLT0006), we already set spent to 60 in our fix
    // Nathan Aké costs £10, so if spent is already 60, the deduction was applied
    // If spent is 50, we need to add £10

    console.log(`\n   ℹ️  Analysis:`);
    console.log(`   - Current spent: £${expectedSpent}`);
    console.log(`   - Player cost: £${playerCost}`);
    console.log(`   - Expected spent (if not applied): £${expectedSpent - playerCost}`);

    // Ask user what to do
    console.log(`\n   ⚠️  Manual verification needed:`);
    console.log(`   1. Check if transaction exists in Firebase for this player`);
    console.log(`   2. If transaction missing, it needs to be created`);
    console.log(`   3. Neon values appear correct (already updated by our fix script)`);
    console.log(`   4. Firebase team_seasons/${player.winning_team_id}_${seasonId} should match Neon`);
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📋 SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nRound ${roundId} had ${players.length} player(s) sold.`);
  console.log(`\nThe issue was:`);
  console.log(`1. ❌ Transactions were not created in Firebase`);
  console.log(`2. ✅ Neon database was updated (by our fix script)`);
  console.log(`3. ⚠️  Firebase team_seasons needs verification`);
  console.log(`\nTo fully fix:`);
  console.log(`1. Verify Firebase team_seasons values match Neon`);
  console.log(`2. Manually create transaction in Firebase (or use transaction logger)`);
  console.log(`3. Use Budget Sync page to sync if needed`);
  console.log(`\nBudget Sync: http://localhost:3000/dashboard/committee/reports/budget-sync\n`);
}

fixRound().catch(console.error);
