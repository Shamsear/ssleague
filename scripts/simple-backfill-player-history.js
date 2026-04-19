/**
 * Simple backfill for player_history
 * 
 * For each current footballplayer:
 * - If they were released (in release transactions): S16 start → mid-S16 end (status='released')
 * - If they're still active: S16 start → S17 current (status='active')
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

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

async function simpleBackfill() {
  console.log('\n🔄 Simple backfill of player_history...\n');

  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await sql`DELETE FROM player_history`;
    console.log('✅ Cleared\n');

    // Get all release transactions (football players only)
    console.log('Loading release transactions...');
    const releasesSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'release')
      .where('player_type', '==', 'football')
      .get();

    console.log(`Found ${releasesSnapshot.size} released players\n`);

    // Create history records for released players
    console.log('Creating history for released players...');
    let releasedCount = 0;
    
    for (const doc of releasesSnapshot.docs) {
      const releaseData = doc.data();
      
      // Get player details
      const playerDetails = await sql`
        SELECT position FROM footballplayers WHERE player_id = ${releaseData.player_id} LIMIT 1
      `;
      
      await sql`
        INSERT INTO player_history (
          player_id,
          player_name,
          position,
          team_id,
          team_name,
          season_id,
          acquisition_type,
          acquisition_value,
          acquisition_date,
          status,
          end_date,
          end_reason,
          transaction_id
        ) VALUES (
          ${releaseData.player_id},
          ${releaseData.player_name},
          ${playerDetails[0]?.position || null},
          ${releaseData.team_id},
          ${releaseData.team_name},
          ${releaseData.season_id},
          'auction',
          ${releaseData.auction_value || 0},
          '2025-12-01',
          'released',
          ${releaseData.created_at?.toDate ? releaseData.created_at.toDate() : new Date()},
          'release',
          ${doc.id}
        )
      `;
      releasedCount++;
      console.log(`  ✅ ${releaseData.player_name} (${releaseData.team_name})`);
    }

    console.log(`\n✅ Created ${releasedCount} released player records\n`);

    // Get all ACTIVE footballplayers from S16 (not released)
    console.log('Loading S16 active footballplayers...');
    const s16Players = await sql`
      SELECT 
        player_id,
        name,
        position,
        team_id,
        team_name,
        season_id,
        acquisition_value,
        round_id,
        is_sold
      FROM footballplayers
      WHERE season_id = 'SSPSLS16'
      AND is_sold = true
    `;

    console.log(`Found ${s16Players.length} S16 active players\n`);

    let activeCount = 0;

    for (const player of s16Players) {
      // Player is still active (S16 → S17)
      await sql`
        INSERT INTO player_history (
          player_id,
          player_name,
          position,
          team_id,
          team_name,
          season_id,
          acquisition_type,
          acquisition_value,
          acquisition_date,
          round_id,
          status
        ) VALUES (
          ${player.player_id},
          ${player.name},
          ${player.position},
          ${player.team_id},
          ${player.team_name},
          ${player.season_id},
          'auction',
          ${player.acquisition_value},
          '2025-12-01',
          ${player.round_id},
          'active'
        )
      `;
      activeCount++;
    }

    console.log('✅ Backfill complete!\n');
    console.log('📊 SUMMARY:');
    console.log(`   Released (S16 start → mid-S16): ${releasedCount}`);
    console.log(`   Active (S16 start → S17 current): ${activeCount}`);
    console.log(`   Total: ${releasedCount + activeCount}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

simpleBackfill()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
