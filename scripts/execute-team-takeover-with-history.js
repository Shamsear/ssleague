/**
 * TEAM TAKEOVER EXECUTION WITH HISTORY PRESERVATION
 * ==================================================
 * 
 * This script:
 * 1. Closes S16 player_history records (marks as 'takeover')
 * 2. Creates new S17 player_history records for new team
 * 3. Updates footballplayers to S17 with new team
 * 4. Updates starred_players
 * 5. Updates team_seasons document
 * 
 * PRESERVES: Complete history in player_history table
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

const TAKEOVER = {
  oldTeamId: 'SSPSLT0023',
  oldTeamName: 'Kopites',
  newTeamId: 'SSPSLT0005',
  newTeamName: 'TM Asgardians',
  takeoverSeason: 'SSPSLS17',
  previousSeason: 'SSPSLS16'
};

const DRY_RUN = false; // Set to false to actually execute

async function executeTakeover() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        TEAM TAKEOVER EXECUTION WITH HISTORY               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  console.log(`Old Team: ${TAKEOVER.oldTeamName} (${TAKEOVER.oldTeamId})`);
  console.log(`New Team: ${TAKEOVER.newTeamName} (${TAKEOVER.newTeamId})`);
  console.log(`Takeover Season: ${TAKEOVER.takeoverSeason}\n`);

  try {
    // Step 1: Close S16 player_history records
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 1: Close S16 player_history records\n');

    const s16History = await sql`
      SELECT id, player_id, player_name, acquisition_value
      FROM player_history
      WHERE team_id = ${TAKEOVER.oldTeamId}
      AND season_id = ${TAKEOVER.previousSeason}
      AND status = 'active'
    `;

    console.log(`Found ${s16History.length} active S16 history records\n`);

    if (!DRY_RUN && s16History.length > 0) {
      await sql`
        UPDATE player_history
        SET 
          status = 'takeover',
          end_date = CURRENT_TIMESTAMP,
          end_reason = 'takeover'
        WHERE team_id = ${TAKEOVER.oldTeamId}
        AND season_id = ${TAKEOVER.previousSeason}
        AND status = 'active'
      `;
      console.log('✅ Closed S16 history records\n');
    } else {
      console.log('📝 Would close these records (dry run)\n');
    }

    // Step 2: Create S17 player_history records
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 2: Create S17 player_history records\n');

    const players = await sql`
      SELECT 
        player_id,
        name,
        position,
        acquisition_value,
        round_id
      FROM footballplayers
      WHERE team_id = ${TAKEOVER.oldTeamId}
      AND season_id = ${TAKEOVER.previousSeason}
      AND is_sold = true
    `;

    console.log(`Creating ${players.length} new S17 history records\n`);

    if (!DRY_RUN) {
      for (const player of players) {
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
            status
          ) VALUES (
            ${player.player_id},
            ${player.name},
            ${player.position},
            ${TAKEOVER.newTeamId},
            ${TAKEOVER.newTeamName},
            ${TAKEOVER.takeoverSeason},
            'takeover',
            ${player.acquisition_value},
            'active'
          )
        `;
      }
      console.log('✅ Created S17 history records\n');
    } else {
      players.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} - ${p.acquisition_value} eCoin`);
      });
      if (players.length > 5) {
        console.log(`   ... and ${players.length - 5} more\n`);
      }
    }

    // Step 3: Update footballplayers
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 3: Update footballplayers table\n');

    if (!DRY_RUN) {
      await sql`
        UPDATE footballplayers
        SET 
          team_id = ${TAKEOVER.newTeamId},
          team_name = ${TAKEOVER.newTeamName},
          season_id = ${TAKEOVER.takeoverSeason}
        WHERE team_id = ${TAKEOVER.oldTeamId}
        AND season_id = ${TAKEOVER.previousSeason}
        AND is_sold = true
      `;
      console.log(`✅ Updated ${players.length} footballplayers records\n`);
    } else {
      console.log(`📝 Would update ${players.length} records\n`);
    }

    // Step 4: Update starred_players
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 4: Update starred_players\n');

    const starred = await sql`
      SELECT COUNT(*) as total
      FROM starred_players
      WHERE team_id = ${TAKEOVER.oldTeamId}
    `;

    if (!DRY_RUN && starred[0].total > 0) {
      await sql`
        UPDATE starred_players
        SET team_id = ${TAKEOVER.newTeamId}
        WHERE team_id = ${TAKEOVER.oldTeamId}
      `;
      console.log(`✅ Updated ${starred[0].total} starred_players records\n`);
    } else {
      console.log(`📝 Would update ${starred[0].total} records\n`);
    }

    // Step 5: Update team_seasons document
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('STEP 5: Update team_seasons document\n');

    const teamSeasonQuery = await db.collection('team_seasons')
      .where('team_id', '==', TAKEOVER.oldTeamId)
      .where('season_id', '==', TAKEOVER.takeoverSeason)
      .get();

    if (teamSeasonQuery.size > 0) {
      const doc = teamSeasonQuery.docs[0];
      const data = doc.data();
      
      console.log(`Found document: ${doc.id}`);
      console.log(`Current budgets: ${data.football_budget} eCoin, ${data.real_player_budget} SSCoin\n`);

      if (!DRY_RUN) {
        await doc.ref.update({
          team_id: TAKEOVER.newTeamId,
          team_name: TAKEOVER.newTeamName
        });
        console.log('✅ Updated team_seasons document\n');
      } else {
        console.log('📝 Would update team_id and team_name\n');
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 EXECUTION SUMMARY\n');
    console.log(`✅ S16 history records: ${s16History.length} closed`);
    console.log(`✅ S17 history records: ${players.length} created`);
    console.log(`✅ footballplayers: ${players.length} updated`);
    console.log(`✅ starred_players: ${starred[0].total} updated`);
    console.log(`✅ team_seasons: 1 document updated`);
    console.log('\n✅ Takeover complete!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during takeover:', error);
    throw error;
  }
}

executeTakeover()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
