/**
 * Update teamstats for Team Takeover
 * 
 * Update team_name in teamstats table for Season 17
 * from "Kopites" to "TM Asgardians"
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

async function updateTeamStats() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         UPDATE TEAMSTATS FOR TAKEOVER                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  console.log(`Team ID: ${TAKEOVER.oldTeamId}`);
  console.log(`Old Name: ${TAKEOVER.oldTeamName}`);
  console.log(`New Name: ${TAKEOVER.newTeamName}`);
  console.log(`Season: ${TAKEOVER.takeoverSeason}\n`);

  try {
    // Step 1: Check current teamstats records
    console.log('STEP 1: Check current teamstats records\n');

    const currentStats = await sql`
      SELECT *
      FROM teamstats
      WHERE team_id = ${TAKEOVER.oldTeamId}
      AND season_id = ${TAKEOVER.takeoverSeason}
    `;

    console.log(`Found ${currentStats.length} teamstats records for ${TAKEOVER.oldTeamId} in ${TAKEOVER.takeoverSeason}\n`);

    if (currentStats.length > 0) {
      console.log('Current records:');
      currentStats.forEach((record, i) => {
        console.log(`   ${i + 1}. Tournament: ${record.tournament_id || 'N/A'}`);
        console.log(`      Team Name: ${record.team_name}`);
        console.log(`      Stats: ${record.matches_played} matches, ${record.wins}W-${record.draws}D-${record.losses}L`);
      });
      console.log('');
    }

    // Step 2: Update team_name
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 2: Update team_name to TM Asgardians\n');

    if (!DRY_RUN && currentStats.length > 0) {
      await sql`
        UPDATE teamstats
        SET team_name = ${TAKEOVER.newTeamName}
        WHERE team_id = ${TAKEOVER.oldTeamId}
        AND season_id = ${TAKEOVER.takeoverSeason}
      `;
      console.log(`✅ Updated ${currentStats.length} teamstats records\n`);
    } else {
      console.log(`📝 Would update ${currentStats.length} records\n`);
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');
    console.log(`✅ teamstats records updated: ${currentStats.length}`);
    console.log(`✅ Team name changed: ${TAKEOVER.oldTeamName} → ${TAKEOVER.newTeamName}\n`);

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during update:', error);
    throw error;
  }
}

updateTeamStats()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
