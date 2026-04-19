/**
 * Execute Player Seasons Takeover
 * 
 * Transfer real players (SSCoin) from Kopites to TM Asgardians
 * - End Kopites S17 records
 * - Create TM Asgardians S17 records with SAME contracts
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

const TAKEOVER = {
  oldTeamId: 'SSPSLT0023',
  oldTeamName: 'Kopites',
  newTeamId: 'SSPSLT0005',
  newTeamName: 'TM Asgardians',
  takeoverSeason: 'SSPSLS17'
};

const DRY_RUN = false; // Set to false to execute

async function executePlayerSeasonsTakeover() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      EXECUTE PLAYER SEASONS TAKEOVER                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  console.log(`Old Team: ${TAKEOVER.oldTeamName} (${TAKEOVER.oldTeamId})`);
  console.log(`New Team: ${TAKEOVER.newTeamName} (${TAKEOVER.newTeamId})`);
  console.log(`Takeover Season: ${TAKEOVER.takeoverSeason}\n`);

  try {
    // Step 1: Get S17 player_seasons records for Kopites
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 1: Get Kopites S17 player_seasons records\n');

    const s17Players = await sql`
      SELECT *
      FROM player_seasons
      WHERE team_id = ${TAKEOVER.oldTeamId}
      AND season_id = ${TAKEOVER.takeoverSeason}
      AND status = 'active'
    `;

    console.log(`Found ${s17Players.length} active S17 records\n`);

    if (s17Players.length > 0) {
      console.log('Players to transfer:');
      s17Players.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.player_name}`);
        console.log(`      Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
        console.log(`      Star Rating: ${p.star_rating}`);
      });
      console.log('');
    }

    // Step 2: End Kopites S17 records
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 2: End Kopites S17 records\n');

    if (!DRY_RUN && s17Players.length > 0) {
      await sql`
        UPDATE player_seasons
        SET 
          status = 'takeover',
          updated_at = CURRENT_TIMESTAMP
        WHERE team_id = ${TAKEOVER.oldTeamId}
        AND season_id = ${TAKEOVER.takeoverSeason}
        AND status = 'active'
      `;
      console.log(`✅ Ended ${s17Players.length} Kopites S17 records\n`);
    } else {
      console.log(`📝 Would end ${s17Players.length} records\n`);
    }

    // Step 3: Create TM Asgardians S17 records
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 3: Create TM Asgardians S17 records\n');

    if (!DRY_RUN) {
      for (const player of s17Players) {
        // Generate new ID
        const newId = `${TAKEOVER.newTeamId}_${player.player_id}_${TAKEOVER.takeoverSeason}`;

        await sql`
          INSERT INTO player_seasons (
            id,
            player_id,
            season_id,
            team_id,
            player_name,
            team,
            contract_id,
            contract_start_season,
            contract_end_season,
            contract_length,
            is_auto_registered,
            category,
            star_rating,
            points,
            matches_played,
            goals_scored,
            assists,
            wins,
            draws,
            losses,
            clean_sheets,
            motm_awards,
            registration_date,
            registration_status,
            auction_value,
            salary_per_match,
            registration_type,
            status,
            goals_conceded,
            processed_fixtures,
            prevent_auto_promotion,
            base_points,
            created_at,
            updated_at
          ) VALUES (
            ${newId},
            ${player.player_id},
            ${TAKEOVER.takeoverSeason},
            ${TAKEOVER.newTeamId},
            ${player.player_name},
            ${TAKEOVER.newTeamName},
            ${player.contract_id},
            ${player.contract_start_season},  -- KEEP SAME
            ${player.contract_end_season},    -- KEEP SAME
            ${player.contract_length},
            ${player.is_auto_registered || false},
            ${player.category},
            ${player.star_rating || 0},
            ${player.points || 0},
            ${player.matches_played || 0},
            ${player.goals_scored || 0},
            ${player.assists || 0},
            ${player.wins || 0},
            ${player.draws || 0},
            ${player.losses || 0},
            ${player.clean_sheets || 0},
            ${player.motm_awards || 0},
            ${player.registration_date || null},
            ${player.registration_status || 'active'},
            ${player.auction_value || null},
            ${player.salary_per_match || null},
            ${player.registration_type || 'takeover'},
            'active',
            ${player.goals_conceded || 0},
            ${player.processed_fixtures || null},
            ${player.prevent_auto_promotion || false},
            ${player.base_points || 0},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;
      }
      console.log(`✅ Created ${s17Players.length} TM Asgardians S17 records\n`);
    } else {
      console.log('📝 Would create new records for:');
      s17Players.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.player_name} - Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
      });
      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 EXECUTION SUMMARY\n');
    console.log(`✅ Kopites S17 records: ${s17Players.length} ended`);
    console.log(`✅ TM Asgardians S17 records: ${s17Players.length} created`);
    console.log('\n✅ Player seasons takeover complete!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during takeover:', error);
    throw error;
  }
}

executePlayerSeasonsTakeover()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
