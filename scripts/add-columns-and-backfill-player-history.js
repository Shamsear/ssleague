/**
 * Add footballplayers columns to player_history and backfill data
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.NEON_DATABASE_URL);

const DRY_RUN = false; // Set to false to execute

async function addColumnsAndBackfill() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   ADD COLUMNS AND BACKFILL PLAYER_HISTORY                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  try {
    // Step 1: Run migration to add columns
    console.log('STEP 1: Add columns to player_history table\n');

    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_footballplayer_columns_to_player_history.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    if (!DRY_RUN) {
      await sql.unsafe(migrationSQL);
      console.log('✅ Columns added successfully\n');
    } else {
      console.log('📝 Would add columns from migration file\n');
    }

    // Step 2: Get all player_history records that need backfilling
    console.log('STEP 2: Check records needing backfill\n');

    // Wait a moment for schema changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    const historyRecords = await sql`
      SELECT 
        ph.id,
        ph.player_id,
        ph.season_id,
        ph.team_id,
        ph.overall_rating
      FROM player_history ph
      WHERE ph.overall_rating IS NULL
      LIMIT 10
    `;

    console.log(`Found ${historyRecords.length} sample records with NULL overall_rating\n`);

    // Step 3: Backfill data from footballplayers (for records that match)
    console.log('STEP 3: Backfill player data\n');

    if (!DRY_RUN) {
      const result = await sql`
        UPDATE player_history ph
        SET 
          position_group = fp.position_group,
          overall_rating = fp.overall_rating,
          nationality = fp.nationality,
          age = fp.age,
          playing_style = fp.playing_style,
          club = fp.team_name,
          is_sold = fp.is_sold,
          speed = fp.speed,
          acceleration = fp.acceleration,
          ball_control = fp.ball_control,
          dribbling = fp.dribbling,
          low_pass = fp.low_pass,
          lofted_pass = fp.lofted_pass,
          finishing = fp.finishing,
          heading = fp.heading,
          physical_contact = fp.physical_contact,
          stamina = fp.stamina,
          defensive_awareness = fp.defensive_awareness,
          ball_winning = fp.ball_winning,
          aggression = fp.aggression,
          gk_reflexes = fp.gk_reflexes,
          gk_reach = fp.gk_reach,
          gk_handling = fp.gk_handling,
          weak_foot_usage = fp.weak_foot_usage,
          weak_foot_accuracy = fp.weak_foot_accuracy,
          form = fp.form,
          injury_resistance = fp.injury_resistance
        FROM footballplayers fp
        WHERE ph.player_id = fp.player_id
        AND ph.overall_rating IS NULL
      `;
      
      console.log(`✅ Backfilled data for matching records\n`);
    } else {
      console.log('📝 Would backfill data from footballplayers where player_id matches\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ Migration and backfill complete!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

addColumnsAndBackfill()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
