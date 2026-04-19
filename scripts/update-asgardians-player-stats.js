/**
 * Update TM Asgardians S17 Document with Actual Player Stats
 * 
 * Calculate and update:
 * - players_count
 * - position_counts
 * - football_spent (from acquisition values)
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();
const sql = neon(process.env.NEON_DATABASE_URL);

const DRY_RUN = false; // Set to false to execute

async function updatePlayerStats() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    UPDATE TM ASGARDIANS S17 PLAYER STATS                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  try {
    // Get all players for TM Asgardians S17
    console.log('STEP 1: Get all TM Asgardians S17 players\n');
    
    const players = await sql`
      SELECT 
        player_id,
        name,
        position,
        acquisition_value
      FROM footballplayers
      WHERE team_id = 'SSPSLT0005'
      AND season_id = 'SSPSLS17'
      AND is_sold = true
    `;

    console.log(`Found ${players.length} players\n`);

    // Calculate stats
    console.log('STEP 2: Calculate stats\n');

    const playersCount = players.length;
    const totalSpent = players.reduce((sum, p) => sum + (p.acquisition_value || 0), 0);
    
    // Count positions
    const positionCounts = {};
    players.forEach(player => {
      const pos = player.position || 'Unknown';
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });

    console.log(`Players count: ${playersCount}`);
    console.log(`Total spent: ${totalSpent} eCoin`);
    console.log(`Positions:`);
    Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pos, count]) => {
        console.log(`   ${pos}: ${count}`);
      });
    console.log('');

    // Update document
    console.log('STEP 3: Update TM Asgardians S17 document\n');

    const updateData = {
      players_count: playersCount,
      football_spent: totalSpent,
      total_spent: totalSpent,
      position_counts: positionCounts,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!DRY_RUN) {
      await db.collection('team_seasons')
        .doc('SSPSLT0005_SSPSLS17')
        .update(updateData);
      
      console.log('✅ Updated document with player stats\n');
    } else {
      console.log('📝 Would update document with:');
      console.log(`   players_count: ${updateData.players_count}`);
      console.log(`   football_spent: ${updateData.football_spent}`);
      console.log(`   total_spent: ${updateData.total_spent}`);
      console.log(`   position_counts: ${Object.keys(updateData.position_counts).length} positions\n`);
    }

    // Show top players
    console.log('STEP 4: Top 5 players\n');
    
    const topPlayers = players
      .sort((a, b) => (b.acquisition_value || 0) - (a.acquisition_value || 0))
      .slice(0, 5);

    topPlayers.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.position}) - ${p.acquisition_value} eCoin`);
    });

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('✅ Player stats updated!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during update:', error);
    throw error;
  }
}

updatePlayerStats()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
