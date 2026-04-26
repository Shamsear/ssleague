/**
 * Fix NULL stats in player_history for swapped players
 * 
 * This script updates player_history records that have NULL stats
 * by fetching the current stats from footballplayers table
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

async function fixSwapHistoryStats() {
  console.log('🔧 Fixing NULL stats in player_history for swapped players...\n');

  try {
    // Find all swap history records with NULL overall_rating (indicator of missing stats)
    const historyRecords = await sql`
      SELECT id, player_id, player_name, team_id, team_name, acquisition_type, status
      FROM player_history
      WHERE acquisition_type = 'swap'
        AND overall_rating IS NULL
      ORDER BY acquisition_date DESC
    `;

    console.log(`Found ${historyRecords.length} swap history records with NULL stats\n`);

    if (historyRecords.length === 0) {
      console.log('✅ No records need fixing!\n');
      return;
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const record of historyRecords) {
      console.log(`\n📋 Processing: ${record.player_name} (${record.player_id})`);
      console.log(`   History ID: ${record.id}`);
      console.log(`   Team: ${record.team_name} (${record.team_id})`);
      console.log(`   Status: ${record.status}`);

      try {
        // Fetch current player stats from footballplayers
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
            aggression,
            gk_reflexes,
            gk_reach
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

        // team_name should be the real-world club name, not the league team name
        const correctTeamName = player.club || 'Unknown Club';

        // Update the history record with available stats
        const updateResult = await sql`
          UPDATE player_history
          SET 
            team_name = ${correctTeamName},
            position_group = ${player.position_group || null},
            overall_rating = ${player.overall_rating || null},
            nationality = ${player.nationality || null},
            age = ${player.age || null},
            playing_style = ${player.playing_style || null},
            club = ${player.club || null},
            is_sold = ${player.is_sold !== undefined ? player.is_sold : true},
            speed = ${player.speed || null},
            acceleration = ${player.acceleration || null},
            ball_control = ${player.ball_control || null},
            dribbling = ${player.dribbling || null},
            low_pass = ${player.low_pass || null},
            lofted_pass = ${player.lofted_pass || null},
            finishing = ${player.finishing || null},
            heading = ${player.heading || null},
            physical_contact = ${player.physical_contact || null},
            stamina = ${player.stamina || null},
            defensive_awareness = ${player.defensive_awareness || null},
            aggression = ${player.aggression || null},
            gk_reflexes = ${player.gk_reflexes || null},
            gk_reach = ${player.gk_reach || null},
            updated_at = NOW()
          WHERE id = ${record.id}
        `;

        console.log(`   ✅ Updated stats:`);
        console.log(`      Team Name: ${record.team_name} → ${correctTeamName} (real-world club)`);
        console.log(`      Overall Rating: NULL → ${player.overall_rating}`);
        console.log(`      Nationality: NULL → ${player.nationality}`);
        console.log(`      Playing Style: NULL → ${player.playing_style}`);
        updatedCount++;

      } catch (error) {
        console.error(`   ❌ Error updating record:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 Summary');
    console.log('='.repeat(80));
    console.log(`   ✅ Records updated: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total processed: ${historyRecords.length}`);
    console.log('');

    if (updatedCount > 0) {
      console.log('🎉 Stats fixed successfully!\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixSwapHistoryStats();
