/**
 * Execute Real Player Seasons Takeover
 * 
 * 1. End all Kopites player_seasons records
 * 2. Set contract_end_season to SSPSLS17
 * 3. Create new TM Asgardians records for S17+
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

const DRY_RUN = false; // Set to false to execute

async function executeRealPlayerTakeover() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    EXECUTE REAL PLAYER SEASONS TAKEOVER                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  try {
    // Step 1: Get all Kopites player_seasons records
    console.log('STEP 1: Get all Kopites player_seasons records\n');
    
    const kopitesRecords = await sql`
      SELECT *
      FROM player_seasons
      WHERE team_id = 'SSPSLT0023'
      AND status = 'active'
      ORDER BY season_id, player_name
    `;
    
    console.log(`Found ${kopitesRecords.length} active records\n`);

    // Group by season for clarity
    const bySeasonCount = {};
    kopitesRecords.forEach(r => {
      bySeasonCount[r.season_id] = (bySeasonCount[r.season_id] || 0) + 1;
    });
    
    console.log('Breakdown:');
    Object.entries(bySeasonCount).forEach(([season, count]) => {
      console.log(`   ${season}: ${count} records`);
    });
    console.log('');

    // Step 2: End all Kopites records
    console.log('STEP 2: End all Kopites player_seasons records\n');

    if (!DRY_RUN) {
      await sql`
        UPDATE player_seasons
        SET 
          status = 'takeover',
          contract_end_season = 'SSPSLS17',
          updated_at = NOW()
        WHERE team_id = 'SSPSLT0023'
        AND status = 'active'
      `;
      console.log(`✅ Ended ${kopitesRecords.length} Kopites records\n`);
    } else {
      console.log(`📝 Would end ${kopitesRecords.length} records\n`);
    }

    // Step 3: Create new TM Asgardians records
    console.log('STEP 3: Create new TM Asgardians player_seasons records\n');

    // Get unique players and their latest data
    const playerMap = new Map();
    kopitesRecords.forEach(record => {
      const key = record.player_id;
      if (!playerMap.has(key) || record.season_id > playerMap.get(key).season_id) {
        playerMap.set(key, record);
      }
    });

    const uniquePlayers = Array.from(playerMap.values());
    console.log(`Creating records for ${uniquePlayers.length} unique players\n`);

    // Determine which seasons to create records for
    const seasonsToCreate = ['SSPSLS17', 'SSPSLS18']; // S17 and S18
    let createdCount = 0;

    for (const player of uniquePlayers) {
      // Determine which seasons this player should have records for
      const contractEnd = player.contract_end_season;
      const playerSeasons = [];

      if (contractEnd === 'SSPSLS17' || contractEnd === 'SSPSLS16') {
        // Contract ends in S17, only create S17 record
        playerSeasons.push('SSPSLS17');
      } else if (contractEnd === 'SSPSLS18.5' || contractEnd === 'SSPSLS18') {
        // Contract extends to S18, create S17 and S18 records
        playerSeasons.push('SSPSLS17', 'SSPSLS18');
      }

      for (const season of playerSeasons) {
        if (!DRY_RUN) {
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
              ${`${player.player_id}_SSPSLT0005_${season}`},
              ${player.player_id},
              ${season},
              ${'SSPSLT0005'},
              ${player.player_name},
              ${'TM Asgardians'},
              ${`contract_SSPSLT0005_${season}_${Date.now()}`},
              ${'SSPSLS17'},
              ${player.contract_end_season},
              ${player.contract_length || 1},
              ${player.is_auto_registered || false},
              ${player.category},
              ${player.star_rating || 0},
              ${0}, -- Reset points for new season
              ${0}, -- Reset matches
              ${0}, -- Reset goals
              ${0}, -- Reset assists
              ${0}, -- Reset wins
              ${0}, -- Reset draws
              ${0}, -- Reset losses
              ${0}, -- Reset clean sheets
              ${0}, -- Reset MOTM
              ${NOW()},
              ${'active'},
              ${player.auction_value || 0},
              ${player.salary_per_match || 0},
              ${'takeover'},
              ${'active'},
              ${0}, -- Reset goals conceded
              ${'[]'::jsonb},
              ${player.prevent_auto_promotion || false},
              ${0}, -- Reset base points
              ${NOW()},
              ${NOW()}
            )
          `;
          createdCount++;
        }
      }
    }

    if (!DRY_RUN) {
      console.log(`✅ Created ${createdCount} new TM Asgardians records\n`);
    } else {
      console.log('📝 Would create records for:');
      uniquePlayers.forEach((p, i) => {
        const contractEnd = p.contract_end_season;
        const seasons = contractEnd === 'SSPSLS17' || contractEnd === 'SSPSLS16' 
          ? ['S17'] 
          : ['S17', 'S18'];
        console.log(`   ${i + 1}. ${p.player_name} - ${seasons.join(', ')}`);
      });
      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 EXECUTION SUMMARY\n');
    console.log(`✅ Kopites records ended: ${kopitesRecords.length}`);
    console.log(`✅ TM Asgardians records created: ${createdCount || 'Would create'}`);
    console.log('\n✅ Real player seasons takeover complete!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during takeover:', error);
    throw error;
  }
}

executeRealPlayerTakeover()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
