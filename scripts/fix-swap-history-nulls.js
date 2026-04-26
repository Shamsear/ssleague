/**
 * Fix Player History Records with NULL Stats from Swaps
 * 
 * This script:
 * 1. Finds player_history records from swaps that have NULL stats
 * 2. Fetches the current player data from footballplayers table
 * 3. Updates the history records with the correct stats
 */

const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } else {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials\n');
  }
}

const db = admin.firestore();
const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function fixSwapHistoryNulls() {
  console.log('🔧 Fixing player_history records with NULL stats from swaps...\n');

  try {
    // Find all swap history records with NULL overall_rating (indicator of missing stats)
    const nullRecords = await sql`
      SELECT id, player_id, player_name, team_id, team_name, acquisition_date
      FROM player_history
      WHERE acquisition_type = 'swap'
        AND overall_rating IS NULL
      ORDER BY acquisition_date DESC
    `;

    console.log(`Found ${nullRecords.length} history records with NULL stats\n`);

    if (nullRecords.length === 0) {
      console.log('✅ No records need fixing!\n');
      return;
    }

    let fixedCount = 0;
    let errorCount = 0;

    for (const record of nullRecords) {
      console.log(`\n📝 Fixing: ${record.player_name} (${record.player_id})`);
      console.log(`   History ID: ${record.id}`);
      console.log(`   Team: ${record.team_name} (${record.team_id})`);

      try {
        // Fetch current player data from footballplayers
        const playerData = await sql`
          SELECT 
            position_group,
            overall_rating,
            nationality,
            age,
            playing_style,
            club,
            is_sold,
            speed,
            acceleration,
            ball_control,
            dribbling,
            low_pass,
            lofted_pass,
            finishing,
            heading,
            physical_contact,
            stamina,
            defensive_awareness,
            ball_winning,
            aggression,
            gk_reflexes,
            gk_reach,
            gk_handling,
            weak_foot_usage,
            weak_foot_accuracy,
            form,
            injury_resistance
          FROM footballplayers
          WHERE player_id = ${record.player_id}
          LIMIT 1
        `;

        if (playerData.length === 0) {
          console.log(`   ⚠️  Player not found in footballplayers table`);
          errorCount++;
          continue;
        }

        const player = playerData[0];

        // Update the history record with all stats
        await sql`
          UPDATE player_history
          SET 
            position_group = ${player.position_group},
            overall_rating = ${player.overall_rating},
            nationality = ${player.nationality},
            age = ${player.age},
            playing_style = ${player.playing_style},
            club = ${player.club},
            is_sold = ${player.is_sold},
            speed = ${player.speed},
            acceleration = ${player.acceleration},
            ball_control = ${player.ball_control},
            dribbling = ${player.dribbling},
            low_pass = ${player.low_pass},
            lofted_pass = ${player.lofted_pass},
            finishing = ${player.finishing},
            heading = ${player.heading},
            physical_contact = ${player.physical_contact},
            stamina = ${player.stamina},
            defensive_awareness = ${player.defensive_awareness},
            ball_winning = ${player.ball_winning},
            aggression = ${player.aggression},
            gk_reflexes = ${player.gk_reflexes},
            gk_reach = ${player.gk_reach},
            gk_handling = ${player.gk_handling},
            weak_foot_usage = ${player.weak_foot_usage},
            weak_foot_accuracy = ${player.weak_foot_accuracy},
            form = ${player.form},
            injury_resistance = ${player.injury_resistance},
            updated_at = NOW()
          WHERE id = ${record.id}
        `;

        console.log(`   ✅ Updated with stats (OVR: ${player.overall_rating}, Nationality: ${player.nationality})`);
        fixedCount++;

      } catch (error) {
        console.error(`   ❌ Error fixing record:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary');
    console.log('='.repeat(60));
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total found: ${nullRecords.length}`);
    console.log('');

    if (fixedCount > 0) {
      console.log('🎉 Player history records updated with stats!\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

fixSwapHistoryNulls()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  });
