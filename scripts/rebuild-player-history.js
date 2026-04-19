/**
 * Rebuild player_history from scratch
 * 
 * Strategy:
 * 1. Clear existing data
 * 2. Get all footballplayers that were ever sold (from round_players)
 * 3. Create initial acquisition records
 * 4. Process releases chronologically to close records
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

async function rebuildHistory() {
  console.log('\n🔄 Rebuilding player_history from scratch...\n');

  try {
    // Step 1: Clear existing data
    console.log('Step 1: Clearing existing data...');
    await sql`DELETE FROM player_history`;
    console.log('✅ Cleared\n');

    // Step 2: Get all round_players (auction wins)
    console.log('Step 2: Creating records from round_players (auction wins)...');
    const roundPlayers = await sql`
      SELECT 
        rp.player_id,
        rp.player_name,
        rp.winning_team_id as team_id,
        rp.winning_bid as acquisition_value,
        r.season_id,
        r.id as round_id,
        r.created_at as acquisition_date
      FROM round_players rp
      JOIN rounds r ON rp.round_id = r.id
      WHERE rp.winning_team_id IS NOT NULL
      ORDER BY r.created_at
    `;

    console.log(`Found ${roundPlayers.length} auction wins\n`);

    for (const rp of roundPlayers) {
      // Get player and team details
      const playerDetails = await sql`
        SELECT position FROM footballplayers WHERE player_id = ${rp.player_id} LIMIT 1
      `;
      
      const teamDetails = await sql`
        SELECT name FROM teams WHERE id = ${rp.team_id} LIMIT 1
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
          round_id,
          status
        ) VALUES (
          ${rp.player_id},
          ${rp.player_name},
          ${playerDetails[0]?.position || null},
          ${rp.team_id},
          ${teamDetails[0]?.name || 'Unknown'},
          ${rp.season_id},
          'auction',
          ${rp.acquisition_value},
          ${rp.acquisition_date || new Date()},
          ${rp.round_id},
          'active'
        )
      `;
    }

    console.log(`✅ Created ${roundPlayers.length} auction records\n`);

    // Step 3: Process releases
    console.log('Step 3: Processing releases...');
    const releases = await db.collection('transactions')
      .where('transaction_type', '==', 'release')
      .where('player_type', '==', 'football')
      .orderBy('created_at', 'asc')
      .get();

    console.log(`Found ${releases.size} football player releases\n`);

    let releasesProcessed = 0;
    for (const doc of releases.docs) {
      const txn = doc.data();
      
      const closeResult = await sql`
        UPDATE player_history
        SET 
          status = 'released',
          end_date = ${txn.created_at?.toDate ? txn.created_at.toDate() : new Date()},
          end_reason = 'release',
          transaction_id = ${doc.id}
        WHERE player_id = ${txn.player_id}
        AND team_id = ${txn.team_id}
        AND season_id = ${txn.season_id}
        AND status = 'active'
      `;
      
      if (closeResult.count > 0) {
        releasesProcessed++;
        console.log(`  ✅ Closed: ${txn.player_name} (${txn.team_name})`);
      } else {
        console.log(`  ⚠️  No active record found for: ${txn.player_name} (${txn.team_name})`);
      }
    }

    console.log(`\n✅ Processed ${releasesProcessed} releases\n`);

    // Step 4: Summary
    const summary = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM player_history
      GROUP BY status
    `;

    console.log('📊 FINAL SUMMARY:\n');
    summary.forEach(s => {
      console.log(`  ${s.status}: ${s.count} records`);
    });

    console.log('\n✅ Rebuild complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

rebuildHistory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
