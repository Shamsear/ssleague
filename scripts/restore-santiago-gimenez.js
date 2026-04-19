const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

const TEAM_ID = 'SSPSLT0005'; // TM Asgardians
const TEAM_NAME = 'TM Asgardians';
const PLAYER_ID = '118744'; // Santiago Gimenez

async function restoreSantiago() {
  console.log('🔍 Searching for Santiago Gimenez (player_id: 118744)...\n');

  try {
    // 1. Find player in footballplayers
    const players = await sql`
      SELECT 
        id,
        player_id,
        name,
        team_id,
        status,
        is_sold,
        acquisition_value,
        position,
        contract_start_season,
        contract_end_season,
        season_id
      FROM footballplayers
      WHERE player_id = ${PLAYER_ID}
    `;

    if (players.length === 0) {
      console.log('❌ Player not found in footballplayers table');
      return;
    }

    const player = players[0];
    console.log('✅ Found player:');
    console.log(`  Name: ${player.name}`);
    console.log(`  ID: ${player.id}`);
    console.log(`  Player ID: ${player.player_id}`);
    console.log(`  Current Team: ${player.team_id || 'NULL (free agent)'}`);
    console.log(`  Status: ${player.status || 'NULL'}`);
    console.log(`  Is Sold: ${player.is_sold}`);
    console.log(`  Acquisition Value: ${player.acquisition_value}`);
    console.log(`  Position: ${player.position}`);
    console.log(`  Contract: ${player.contract_start_season} → ${player.contract_end_season}`);

    // 2. Check team_players
    const teamPlayers = await sql`
      SELECT * FROM team_players
      WHERE player_id = ${player.id}
        AND team_id = ${TEAM_ID}
    `;

    console.log(`\n📋 Team Players: ${teamPlayers.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);

    // 3. Restore player
    console.log(`\n🔧 Restoring ${player.name} to ${TEAM_NAME}...`);

    // Update footballplayers table
    await sql`
      UPDATE footballplayers
      SET 
        team_id = ${TEAM_ID},
        status = 'active',
        is_sold = true,
        season_id = 'sspsls17',
        updated_at = NOW()
      WHERE id = ${player.id}
    `;
    console.log('  ✅ Updated footballplayers table');

    // Add to team_players if not exists
    if (teamPlayers.length === 0) {
      await sql`
        INSERT INTO team_players (player_id, team_id, season_id, created_at)
        VALUES (${player.id}, ${TEAM_ID}, 'sspsls17', NOW())
        ON CONFLICT DO NOTHING
      `;
      console.log('  ✅ Added to team_players table');
    } else {
      console.log('  ℹ️  Already in team_players table');
    }

    // Check for existing player_history
    const existingHistory = await sql`
      SELECT id, status FROM player_history
      WHERE player_id = ${PLAYER_ID}
        AND team_id = ${TEAM_ID}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existingHistory.length > 0 && existingHistory[0].status === 'released') {
      // Reopen the closed history record
      await sql`
        UPDATE player_history
        SET 
          status = 'active',
          end_date = NULL,
          end_reason = NULL,
          contract_end_season = ${player.contract_end_season || 'sspsls18'},
          updated_at = NOW()
        WHERE id = ${existingHistory[0].id}
      `;
      console.log('  ✅ Reopened player_history record');
    } else if (existingHistory.length === 0) {
      // Create new history record
      await sql`
        INSERT INTO player_history (
          player_id,
          player_name,
          position,
          team_id,
          team_name,
          season_id,
          acquisition_type,
          acquisition_value,
          contract_start_season,
          contract_end_season,
          status,
          acquisition_date,
          created_at,
          updated_at
        ) VALUES (
          ${PLAYER_ID},
          ${player.name},
          ${player.position},
          ${TEAM_ID},
          ${TEAM_NAME},
          'sspsls17',
          'carryover',
          ${player.acquisition_value || 0},
          ${player.contract_start_season || 'sspsls17'},
          ${player.contract_end_season || 'sspsls18'},
          'active',
          NOW(),
          NOW(),
          NOW()
        )
      `;
      console.log('  ✅ Created new player_history record');
    } else {
      console.log('  ℹ️  Player_history already active');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ RESTORE COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ ${player.name} restored to ${TEAM_NAME}`);
    console.log('✅ footballplayers table updated');
    console.log('✅ team_players table updated');
    console.log('✅ player_history record updated/created');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
restoreSantiago()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
