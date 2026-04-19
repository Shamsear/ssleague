const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

const TEAM_ID = 'SSPSLT0005'; // TM Asgardians
const TEAM_NAME = 'TM Asgardians';

const PLAYER_SEARCH_TERMS = [
  'SAELEMAEKERS',
  'SANTIAGO GIMENEZ'
];

async function findAndReverseRelease() {
  console.log('🔍 Searching for players...\n');

  try {
    // 1. Search for players in team_players
    console.log('📋 Searching team_players table...');
    for (const searchTerm of PLAYER_SEARCH_TERMS) {
      const teamPlayers = await sql`
        SELECT 
          tp.player_id,
          tp.team_id,
          tp.season_id,
          fp.name as player_name,
          fp.player_id as fp_player_id,
          fp.position,
          fp.acquisition_value,
          fp.contract_start_season,
          fp.contract_end_season,
          fp.team_id as current_team_id,
          fp.status as current_status,
          fp.is_sold
        FROM team_players tp
        JOIN footballplayers fp ON tp.player_id = fp.id
        WHERE tp.team_id = ${TEAM_ID}
          AND fp.name ILIKE ${`%${searchTerm}%`}
      `;

      if (teamPlayers.length > 0) {
        console.log(`\n✅ Found player matching "${searchTerm}":`);
        const player = teamPlayers[0];
        console.log(`  Name: ${player.player_name}`);
        console.log(`  Player ID (footballplayers.id): ${player.player_id}`);
        console.log(`  Player ID (footballplayers.player_id): ${player.fp_player_id}`);
        console.log(`  Current team_id: ${player.current_team_id || 'NULL (released)'}`);
        console.log(`  Current status: ${player.current_status || 'NULL'}`);
        console.log(`  Is sold: ${player.is_sold}`);
        console.log(`  Acquisition Value: ${player.acquisition_value}`);
        console.log(`  Contract: ${player.contract_start_season} → ${player.contract_end_season}`);

        // Restore the player
        console.log(`\n🔧 Restoring ${player.player_name}...`);
        
        // Update footballplayers table
        await sql`
          UPDATE footballplayers
          SET 
            team_id = ${TEAM_ID},
            status = 'active',
            is_sold = true,
            season_id = ${player.season_id || 'sspsls17'},
            updated_at = NOW()
          WHERE id = ${player.player_id}
        `;
        console.log(`  ✅ Updated footballplayers table`);

        // Check for existing player_history
        const existingHistory = await sql`
          SELECT id, status FROM player_history
          WHERE player_id = ${player.fp_player_id || player.player_id}
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
              contract_end_season = ${player.contract_end_season},
              updated_at = NOW()
            WHERE id = ${existingHistory[0].id}
          `;
          console.log(`  ✅ Reopened player_history record`);
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
              ${player.fp_player_id || player.player_id},
              ${player.player_name},
              ${player.position},
              ${TEAM_ID},
              ${TEAM_NAME},
              ${player.season_id || 'sspsls17'},
              'carryover',
              ${player.acquisition_value},
              ${player.contract_start_season},
              ${player.contract_end_season},
              'active',
              NOW(),
              NOW(),
              NOW()
            )
          `;
          console.log(`  ✅ Created new player_history record`);
        } else {
          console.log(`  ℹ️  Player_history already active`);
        }

        console.log(`  ✅ ${player.player_name} fully restored!\n`);
      } else {
        console.log(`\n❌ No player found matching "${searchTerm}"`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ REVERSE COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Players restored to TM Asgardians');
    console.log('✅ footballplayers table updated (team_id, status, is_sold)');
    console.log('✅ player_history records updated/created');
    console.log('\n⚠️  NOTE: You may need to manually adjust budgets if refunds were given');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
findAndReverseRelease()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
