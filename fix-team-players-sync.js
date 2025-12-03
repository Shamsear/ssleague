/**
 * Sync team_players table with footballplayers table
 * Run this after doing swaps with the old code
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function syncTeamPlayers() {
  const dbUrl = process.env.DATABASE_URL || process.env.AUCTION_DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL not found in environment variables');
    console.log('Make sure .env.local file exists with DATABASE_URL');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('🔍 Checking for mismatches between team_players and footballplayers...\n');

  // Find mismatches
  const mismatches = await sql`
    SELECT 
      tp.id as team_player_id,
      tp.player_id,
      tp.team_id as old_team_id,
      fp.team_id as new_team_id,
      fp.name as player_name,
      tp.season_id
    FROM team_players tp
    JOIN footballplayers fp ON tp.player_id = fp.player_id AND tp.season_id = fp.season_id
    WHERE tp.team_id != fp.team_id
  `;

  if (mismatches.length === 0) {
    console.log('✅ No mismatches found! team_players is in sync with footballplayers.');
    return;
  }

  console.log(`⚠️  Found ${mismatches.length} mismatch(es):\n`);
  
  mismatches.forEach((m, i) => {
    console.log(`${i + 1}. ${m.player_name} (${m.player_id})`);
    console.log(`   Season: ${m.season_id}`);
    console.log(`   team_players: ${m.old_team_id}`);
    console.log(`   footballplayers: ${m.new_team_id}`);
    console.log(`   → Will update to: ${m.new_team_id}\n`);
  });

  // Fix the mismatches
  console.log('🔧 Fixing mismatches...\n');

  const result = await sql`
    UPDATE team_players tp
    SET 
      team_id = fp.team_id,
      updated_at = NOW()
    FROM footballplayers fp
    WHERE 
      tp.player_id = fp.player_id 
      AND tp.season_id = fp.season_id
      AND tp.team_id != fp.team_id
  `;

  console.log(`✅ Fixed ${mismatches.length} record(s) in team_players table!`);
  
  // Verify
  const remaining = await sql`
    SELECT COUNT(*) as count
    FROM team_players tp
    JOIN footballplayers fp ON tp.player_id = fp.player_id AND tp.season_id = fp.season_id
    WHERE tp.team_id != fp.team_id
  `;

  if (remaining[0].count === 0) {
    console.log('✅ Verification passed! All records are now in sync.');
  } else {
    console.log(`⚠️  Warning: ${remaining[0].count} mismatch(es) still remain.`);
  }
}

syncTeamPlayers()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
