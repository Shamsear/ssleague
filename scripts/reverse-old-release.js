const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

const TEAM_ID = 'SSPSLT0005'; // TM Asgardians
const TEAM_NAME = 'TM Asgardians';

const PLAYERS_TO_RESTORE = [
  'SAELEMAEKERS-RMF',
  'SANTIAGO GIMENEZ-CF'
];

async function reverseOldRelease() {
  console.log('🔄 Starting reverse of old release...\n');

  try {
    // 1. Get player details from team_players table
    console.log('📋 Fetching player details from team_players...');
    const teamPlayers = await sql`
      SELECT 
        tp.player_id,
        tp.team_id,
        tp.season_id,
        fp.name as player_name,
        fp.position,
        fp.acquisition_value,
        fp.contract_start_season,
        fp.contract_end_season,
        fp.contract_id
      FROM team_players tp
      JOIN footballplayers fp ON tp.player_id = fp.id
      WHERE tp.team_id = ${TEAM_ID}
        AND fp.name = ANY(${PLAYERS_TO_RESTORE})
    `;

    if (teamPlayers.length === 0) {
      console.log('❌ No players found in team_players table');
      return;
    }

    console.log(`✅ Found ${teamPlayers.length} player(s) in team_players:\n`);
    teamPlayers.forEach(p => {
      console.log(`  • ${p.player_name}`);
      console.log(`    Player ID: ${p.player_id}`);
      console.log(`    Acquisition Value: ${p.acquisition_value}`);
      console.log(`    Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
      console.log('');
    });

    // 2. Restore players in footballplayers table
    console.log('🔧 Restoring players in footballplayers table...');
    for (const player of teamPlayers) {
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
      console.log(`  ✅ Restored ${player.player_name} in footballplayers`);
    }

    // 3. Create/restore player_history records
    console.log('\n📝 Creating player_history records...');
    for (const player of teamPlayers) {
      // Check if history record exists
      const existingHistory = await sql`
        SELECT id FROM player_history
        WHERE player_id = ${player.player_id}
          AND team_id = ${TEAM_ID}
          AND status = 'released'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (existingHistory.length > 0) {
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
        console.log(`  ✅ Reopened player_history for ${player.player_name}`);
      } else {
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
            ${player.player_id},
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
        console.log(`  ✅ Created player_history for ${player.player_name}`);
      }
    }

    // 4. Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ REVERSE COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Restored ${teamPlayers.length} player(s) to ${TEAM_NAME}:`);
    teamPlayers.forEach(p => {
      console.log(`  • ${p.player_name} (${p.position})`);
    });
    console.log('\n✅ Players are now back in:');
    console.log('  - footballplayers table (team_id set, status=active, is_sold=true)');
    console.log('  - team_players table (already there)');
    console.log('  - player_history table (status=active)');
    console.log('\n⚠️  NOTE: You may need to manually adjust budgets if refunds were given');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
reverseOldRelease()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
