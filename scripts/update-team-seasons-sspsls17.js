/**
 * Update Firebase team_seasons for SSPSLS17
 * - Update players_count with football players count
 * - Update position_counts with position breakdown
 */

const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

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
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

// Initialize Neon connection for auction database
const auctionSql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

const SEASON_ID = 'SSPSLS17';

async function updateTeamSeasons() {
  try {
    console.log(`\n🔄 Starting update for season ${SEASON_ID}...`);

    // Get all team_seasons for SSPSLS17
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('season_id', '==', SEASON_ID)
      .get();

    console.log(`📊 Found ${teamSeasonsSnapshot.size} team_seasons documents for ${SEASON_ID}`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const doc of teamSeasonsSnapshot.docs) {
      const teamSeasonData = doc.data();
      const teamId = teamSeasonData.team_id;
      const docId = doc.id;

      console.log(`\n📝 Processing ${teamSeasonData.team_name} (${teamId})...`);

      try {
        // Query football players with active contracts for this season
        const footballPlayers = await auctionSql`
          SELECT 
            fp.position,
            fp.position_group,
            fp.name as player_name
          FROM team_players tp
          INNER JOIN footballplayers fp ON tp.player_id = fp.id
          WHERE tp.team_id = ${teamId}
            AND (
              fp.contract_start_season <= ${SEASON_ID}
              AND fp.contract_end_season >= ${SEASON_ID}
            )
        `;

        console.log(`   ⚽ Found ${footballPlayers.length} football players`);

        // Calculate position counts
        const positionCounts = {};
        footballPlayers.forEach(player => {
          const position = player.position || 'Unknown';
          positionCounts[position] = (positionCounts[position] || 0) + 1;
        });

        console.log(`   📊 Position breakdown:`, positionCounts);

        // Update Firebase document
        const updateData = {
          players_count: footballPlayers.length,
          position_counts: positionCounts,
          last_updated: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection('team_seasons').doc(docId).update(updateData);

        console.log(`   ✅ Updated ${teamSeasonData.team_name}: ${footballPlayers.length} players`);
        updatedCount++;

      } catch (error) {
        console.error(`   ❌ Error updating ${teamSeasonData.team_name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✨ Update complete!`);
    console.log(`   ✅ Successfully updated: ${updatedCount} teams`);
    console.log(`   ❌ Errors: ${errorCount} teams`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run the script
updateTeamSeasons()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
