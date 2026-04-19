/**
 * Reverse player releases for SAELEMAEKERS and SANTIAGO GIMENEZ
 * These were released using old model that only updated footballplayers table
 * Need to restore them back to TM Asgardians (SSPSLT0005)
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

const TEAM_ID = 'SSPSLT0005';
const TEAM_NAME = 'TM Asgardians';
const SEASON_ID = 'sspsls17';

const PLAYERS_TO_RESTORE = [
  {
    name: 'SAELEMAEKERS',
    position: 'RMF',
    // Will find by name pattern
  },
  {
    name: 'SANTIAGO GIMENEZ',
    position: 'CF',
    // Will find by name pattern
  }
];

async function reverseReleases() {
  console.log('🔄 Starting player release reversal...\n');

  for (const playerInfo of PLAYERS_TO_RESTORE) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing: ${playerInfo.name} (${playerInfo.position})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      // 1. Find the player in footballplayers table
      const players = await sql`
        SELECT 
          id,
          player_id,
          name,
          position,
          team_id,
          status,
          is_sold,
          acquisition_value,
          contract_start_season,
          contract_end_season,
          season_id
        FROM footballplayers
        WHERE name ILIKE ${`%${playerInfo.name}%`}
        AND position = ${playerInfo.position}
        LIMIT 1
      `;

      if (players.length === 0) {
        console.log(`❌ Player not found: ${playerInfo.name}`);
        continue;
      }

      const player = players[0];
      console.log(`✅ Found player:`, {
        id: player.id,
        player_id: player.player_id,
        name: player.name,
        current_team: player.team_id || 'FREE AGENT',
        status: player.status,
        is_sold: player.is_sold
      });

      // 2. Check if player is currently free agent
      if (player.team_id && player.team_id !== 'free_agent') {
        console.log(`⚠️  Player is already assigned to team: ${player.team_id}`);
        console.log(`   Skipping...`);
        continue;
      }

      // 3. Find the most recent player_history record for this player with TM Asgardians
      const historyRecords = await sql`
        SELECT 
          id,
          player_id,
          player_name,
          team_id,
          team_name,
          season_id,
          acquisition_value,
          contract_start_season,
          contract_end_season,
          status,
          end_date,
          end_reason
        FROM player_history
        WHERE player_id = ${player.player_id}
        AND team_id = ${TEAM_ID}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      let acquisitionValue = player.acquisition_value;
      let contractStart = player.contract_start_season;
      let contractEnd = player.contract_end_season;

      if (historyRecords.length > 0) {
        const history = historyRecords[0];
        console.log(`\n📋 Found player_history record:`, {
          team: history.team_name,
          season: history.season_id,
          acquisition_value: history.acquisition_value,
          contract: `${history.contract_start_season} → ${history.contract_end_season}`,
          status: history.status,
          end_reason: history.end_reason
        });

        // Use values from history if available
        acquisitionValue = history.acquisition_value || acquisitionValue;
        contractStart = history.contract_start_season || contractStart;
        contractEnd = history.contract_end_season || contractEnd;

        // Reactivate the player_history record
        await sql`
          UPDATE player_history
          SET 
            status = 'active',
            end_date = NULL,
            end_reason = NULL,
            updated_at = NOW()
          WHERE id = ${history.id}
        `;
        console.log(`✅ Reactivated player_history record`);
      } else {
        console.log(`⚠️  No player_history record found for ${TEAM_NAME}`);
        console.log(`   Will use current player data`);
      }

      // 4. Update footballplayers table - restore to team
      await sql`
        UPDATE footballplayers
        SET 
          team_id = ${TEAM_ID},
          status = 'active',
          is_sold = true,
          season_id = ${SEASON_ID},
          acquisition_value = ${acquisitionValue},
          contract_start_season = ${contractStart},
          contract_end_season = ${contractEnd},
          updated_at = NOW()
        WHERE id = ${player.id}
      `;
      console.log(`✅ Updated footballplayers table - restored to ${TEAM_NAME}`);

      // 5. Add to team_players table if not exists
      try {
        // Check if already exists
        const existingTeamPlayer = await sql`
          SELECT id FROM team_players
          WHERE player_id = ${player.id}
          AND team_id = ${TEAM_ID}
        `;

        if (existingTeamPlayer.length === 0) {
          await sql`
            INSERT INTO team_players (player_id, team_id, season_id, created_at)
            VALUES (${player.id}, ${TEAM_ID}, ${SEASON_ID}, NOW())
          `;
          console.log(`✅ Added to team_players table`);
        } else {
          console.log(`ℹ️  Already exists in team_players table`);
        }
      } catch (teamPlayerError) {
        console.log(`⚠️  Could not add to team_players:`, teamPlayerError.message);
      }

      console.log(`\n✅ Successfully restored ${player.name} to ${TEAM_NAME}`);

    } catch (error) {
      console.error(`❌ Error processing ${playerInfo.name}:`, error);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Release reversal complete!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// Run the script
reverseReleases()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
