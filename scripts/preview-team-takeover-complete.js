/**
 * COMPLETE TEAM TAKEOVER PREVIEW
 * ===============================
 * Scenario: Kopites left, TM Asgardians took over the team
 * 
 * IMPORTANT: footballplayers table has UNIQUE player_id constraint
 * - Cannot create new records for S17
 * - Must UPDATE existing S16 records to S17 with new team
 * - S16 footballplayers history will be lost (only transactions remain)
 * 
 * - Season 17 onwards: Transfers to TM Asgardians
 * - Round data from S16: Stays with Kopites (historical)
 * 
 * This is a TEAM TAKEOVER, not a player transfer
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

async function checkContractedPlayers() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          CONTRACTED PLAYERS FROM SEASON 16                 ║');
  console.log('║          (WILL BE UPDATED TO S17 - NOT CREATED)            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check footballplayers with contracts from S16
    const contractedFootball = await sql`
      SELECT 
        player_id,
        name,
        position,
        team_name,
        season_id,
        acquisition_value,
        is_sold
      FROM footballplayers 
      WHERE team_id = ${TAKEOVER.oldTeamId} 
      AND season_id = ${TAKEOVER.previousSeason}
      AND is_sold = true
      ORDER BY acquisition_value DESC NULLS LAST
    `;

    console.log(`📊 Football Players from S16 (will UPDATE to S17):`);
    console.log(`   Total: ${contractedFootball.length} players\n`);
    console.log(`   ⚠️  NOTE: These records will be UPDATED, not created`);
    console.log(`   ⚠️  S16 footballplayers history will be lost (transactions remain)\n`);

    if (contractedFootball.length > 0) {
      console.log('   Players list:');
      contractedFootball.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (${p.position}) - ${p.acquisition_value || 0} eCoin`);
      });
      
      const totalValue = contractedFootball.reduce((sum, p) => sum + (p.acquisition_value || 0), 0);
      console.log(`\n   Total acquisition value: ${totalValue} eCoin`);
    }

    return { footballPlayers: contractedFootball };

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    return { error: error.message };
  }
}

async function checkSeason16Data() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     SEASON 16 DATA (STAYS WITH KOPITES)                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {};

  try {
    // S16 Football Players
    const s16Football = await sql`
      SELECT COUNT(*) as total,
             SUM(COALESCE(acquisition_value, 0)) as total_value
      FROM footballplayers 
      WHERE team_id = ${TAKEOVER.oldTeamId} 
      AND season_id = ${TAKEOVER.previousSeason}
    `;
    results.footballPlayers = s16Football[0];
    console.log(`📊 Football Players: ${s16Football[0].total} records`);
    console.log(`   ⚠️  Will be UPDATED to S17 (history lost from this table)`);
    console.log(`   Total value: ${s16Football[0].total_value} eCoin`);

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
  }

  try {
    // S16 Round Players (from rounds 21-25)
    const s16RoundPlayers = await sql`
      SELECT COUNT(*) as total
      FROM round_players rp
      JOIN rounds r ON rp.round_id = r.id
      WHERE rp.winning_team_id = ${TAKEOVER.oldTeamId}
      AND r.season_id = ${TAKEOVER.previousSeason}
    `;
    results.roundPlayers = s16RoundPlayers[0].total;
    console.log(`\n📊 Round Players: ${s16RoundPlayers[0].total} records (rounds 21-25)`);
    console.log(`   ✅ Will remain with Kopites (no changes)`);

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
  }

  try {
    // S16 Round Bids
    const s16RoundBids = await sql`
      SELECT COUNT(*) as total,
             SUM(COALESCE(bid_amount, 0)) as total_bids
      FROM round_bids rb
      JOIN rounds r ON rb.round_id = r.id
      WHERE rb.team_id = ${TAKEOVER.oldTeamId}
      AND r.season_id = ${TAKEOVER.previousSeason}
    `;
    results.roundBids = s16RoundBids[0];
    console.log(`\n📊 Round Bids: ${s16RoundBids[0].total} records (${s16RoundBids[0].total_bids} eCoin)`);
    console.log(`   ✅ Will remain with Kopites (no changes)`);

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
  }

  try {
    // S16 Transactions
    const s16Transactions = await db.collection('transactions')
      .where('team_id', '==', TAKEOVER.oldTeamId)
      .where('season_id', '==', TAKEOVER.previousSeason)
      .get();

    results.transactions = s16Transactions.size;
    console.log(`\n📊 Transactions: ${s16Transactions.size} documents`);
    console.log(`   ✅ Will remain with Kopites (no changes)`);

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
  }

  try {
    // S16 Team Season
    const s16TeamSeason = await db.collection('team_seasons')
      .where('team_id', '==', TAKEOVER.oldTeamId)
      .where('season_id', '==', TAKEOVER.previousSeason)
      .get();

    if (s16TeamSeason.size > 0) {
      const data = s16TeamSeason.docs[0].data();
      results.teamSeason = data;
      console.log(`\n📊 Team Season: Found`);
      console.log(`   Football budget: ${data.football_budget || 0}`);
      console.log(`   Football spent: ${data.football_spent || 0}`);
      console.log(`   ✅ Will remain with Kopites (no changes)`);
    }

  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
  }

  return results;
}

async function checkSeason17Data() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   SEASON 17 DATA (TRANSFERS TO TM ASGARDIANS)             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {};

  // NEON Database
  console.log('📊 NEON DATABASE:\n');

  try {
    const s17Football = await sql`
      SELECT COUNT(*) as total,
             SUM(COALESCE(acquisition_value, 0)) as total_value
      FROM footballplayers 
      WHERE team_id = ${TAKEOVER.oldTeamId} 
      AND season_id = ${TAKEOVER.takeoverSeason}
    `;
    results.footballPlayers = s17Football[0];
    console.log(`   Football Players: ${s17Football[0].total} records`);
    if (s17Football[0].total > 0) {
      console.log(`   Total value: ${s17Football[0].total_value} eCoin`);
    }
  } catch (error) {
    console.log(`   ⚠️  Football Players error: ${error.message}`);
  }

  try {
    const starred = await sql`
      SELECT COUNT(*) as total
      FROM starred_players 
      WHERE team_id = ${TAKEOVER.oldTeamId}
    `;
    results.starredPlayers = starred[0].total;
    console.log(`   Starred Players: ${starred[0].total} records`);
  } catch (error) {
    console.log(`   ⚠️  Starred Players error: ${error.message}`);
  }

  // FIREBASE
  console.log('\n📊 FIREBASE:\n');

  try {
    const s17Transactions = await db.collection('transactions')
      .where('team_id', '==', TAKEOVER.oldTeamId)
      .where('season_id', '==', TAKEOVER.takeoverSeason)
      .get();

    results.transactions = s17Transactions.size;
    console.log(`   Transactions: ${s17Transactions.size} documents`);
  } catch (error) {
    console.log(`   ⚠️  Transactions error: ${error.message}`);
  }

  try {
    const s17TeamSeason = await db.collection('team_seasons')
      .where('team_id', '==', TAKEOVER.oldTeamId)
      .where('season_id', '==', TAKEOVER.takeoverSeason)
      .get();

    if (s17TeamSeason.size > 0) {
      const data = s17TeamSeason.docs[0].data();
      results.teamSeason = data;
      results.teamSeasonDocId = s17TeamSeason.docs[0].id;
      console.log(`   Team Season: Found (${s17TeamSeason.docs[0].id})`);
      console.log(`     - Football budget: ${data.football_budget || 0} eCoin`);
      console.log(`     - Football spent: ${data.football_spent || 0} eCoin`);
      console.log(`     - Real budget: ${data.real_player_budget || 0} SSCoin`);
      console.log(`     - Real spent: ${data.real_player_spent || 0} SSCoin`);
      console.log(`     - Transfers used: ${data.transfers_used || 0}/2`);
    }
  } catch (error) {
    console.log(`   ⚠️  Team Season error: ${error.message}`);
  }

  return results;
}

function generateSummary(contractedPlayers, s16Data, s17Data) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                  TAKEOVER SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Old Team: ${TAKEOVER.oldTeamName} (${TAKEOVER.oldTeamId})`);
  console.log(`New Team: ${TAKEOVER.newTeamName} (${TAKEOVER.newTeamId})`);
  console.log(`Takeover Season: ${TAKEOVER.takeoverSeason}\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📋 WHAT WILL BE UPDATED/TRANSFERRED:\n');

  console.log('1️⃣  FOOTBALLPLAYERS TABLE (NEON):');
  if (contractedPlayers.footballPlayers) {
    console.log(`   • ${contractedPlayers.footballPlayers.length} players will be UPDATED`);
    console.log(`   • team_id: ${TAKEOVER.oldTeamId} → ${TAKEOVER.newTeamId}`);
    console.log(`   • team_name: ${TAKEOVER.oldTeamName} → ${TAKEOVER.newTeamName}`);
    console.log(`   • season_id: ${TAKEOVER.previousSeason} → ${TAKEOVER.takeoverSeason}`);
    console.log(`   • acquisition_value: preserved`);
    console.log(`   ⚠️  S16 footballplayers history will be lost`);
  }

  console.log('\n2️⃣  STARRED_PLAYERS TABLE (NEON):');
  if (s17Data.starredPlayers) {
    console.log(`   • ${s17Data.starredPlayers} records will be updated`);
    console.log(`   • team_id: ${TAKEOVER.oldTeamId} → ${TAKEOVER.newTeamId}`);
  }

  console.log('\n3️⃣  TEAM_SEASONS DOCUMENT (FIREBASE):');
  if (s17Data.teamSeason) {
    console.log(`   • Document ID: ${s17Data.teamSeasonDocId || 'SSPSLT0023_SSPSLS17'}`);
    console.log(`   • team_id: ${TAKEOVER.oldTeamId} → ${TAKEOVER.newTeamId}`);
    console.log(`   • team_name: ${TAKEOVER.oldTeamName} → ${TAKEOVER.newTeamName}`);
    console.log(`   • Budgets preserved: ${s17Data.teamSeason.football_budget} eCoin, ${s17Data.teamSeason.real_player_budget} SSCoin`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📋 WHAT STAYS WITH KOPITES (NO CHANGES):\n');

  console.log('1️⃣  SEASON 16 AUCTION DATA (NEON):');
  if (s16Data.roundPlayers) {
    console.log(`   • ${s16Data.roundPlayers} round_players (rounds 21-25)`);
  }
  if (s16Data.roundBids) {
    console.log(`   • ${s16Data.roundBids.total} round_bids (${s16Data.roundBids.total_bids} eCoin)`);
  }

  console.log('\n2️⃣  SEASON 16 FIREBASE DATA:');
  if (s16Data.transactions) {
    console.log(`   • ${s16Data.transactions} transactions (historical)`);
  }
  if (s16Data.teamSeason) {
    console.log(`   • Team season document (historical)`);
  }
  console.log(`   • All awards, achievements, match history from S16`);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('⚠️  IMPORTANT NOTES:\n');
  console.log('   1. footballplayers table has UNIQUE player_id constraint');
  console.log('   2. Cannot create new S17 records - must UPDATE existing S16 records');
  console.log('   3. S16 footballplayers history will be lost from that table');
  console.log('   4. S16 transaction history remains intact (280 documents)');
  console.log('   5. S16 auction data (round_players, round_bids) remains with Kopites');
  console.log('   6. NO transaction records needed - this is ownership change');

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('💡 EXECUTION PLAN:\n');
  console.log('   1. UPDATE footballplayers: change team_id, team_name, season_id');
  console.log('   2. UPDATE starred_players: change team_id');
  console.log('   3. UPDATE team_seasons document: change team_id, team_name');
  console.log('   4. Leave all S16 auction data unchanged');

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        COMPLETE TEAM TAKEOVER PREVIEW & ANALYSIS          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    const contractedPlayers = await checkContractedPlayers();
    const s16Data = await checkSeason16Data();
    const s17Data = await checkSeason17Data();
    
    generateSummary(contractedPlayers, s16Data, s17Data);

    console.log('✅ Preview complete!\n');
    console.log('⚠️  IMPORTANT: Review all data above before proceeding.\n');
    console.log('📝 Next step: Review and confirm, then I\'ll create the execution script.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during preview:', error);
    process.exit(1);
  }
}

main();
