import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function syncTeamLogos() {
  console.log('🔄 Syncing team logos from team_seasons to teams collection...\n');

  let syncedCount = 0;
  let errorCount = 0;

  try {
    // Get all team_seasons
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    console.log(`📊 Found ${teamSeasonsSnapshot.size} team_seasons documents\n`);

    for (const doc of teamSeasonsSnapshot.docs) {
      const data = doc.data();
      const teamId = data.team_id;
      const teamLogo = data.team_logo;
      const seasonId = data.season_id;

      if (!teamId) {
        console.log(`⚠️  Skipping document ${doc.id} - no team_id`);
        continue;
      }

      if (!teamLogo) {
        continue; // Skip if no logo in team_seasons
      }

      try {
        // Check if teams collection has this logo
        const teamRef = db.collection('teams').doc(teamId);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
          console.log(`⚠️  Team ${teamId} not found in teams collection`);
          continue;
        }

        const teamData = teamDoc.data();
        const currentTeamLogo = teamData?.logo_url;

        if (currentTeamLogo === teamLogo) {
          // Already synced
          continue;
        }

        // Update the teams collection
        await teamRef.update({ logo_url: teamLogo });
        console.log(`✅ Synced ${teamId} (${teamData?.name || 'Unknown'})`);
        console.log(`   From: ${currentTeamLogo || 'NULL'}`);
        console.log(`   To: ${teamLogo}`);
        console.log(`   Season: ${seasonId}\n`);
        
        syncedCount++;

      } catch (error: any) {
        console.error(`❌ Error syncing ${teamId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successfully synced: ${syncedCount} teams`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('\n✨ Sync complete!\n');

  } catch (error) {
    console.error('❌ Error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
syncTeamLogos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
