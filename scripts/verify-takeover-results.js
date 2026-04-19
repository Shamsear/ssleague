/**
 * Verify Team Takeover Results
 * Checks that all data was properly transferred
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

async function verifyTakeover() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           TEAM TAKEOVER VERIFICATION                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check footballplayers
    console.log('1️⃣  FOOTBALLPLAYERS TABLE\n');
    
    const s17Players = await sql`
      SELECT COUNT(*) as total, SUM(acquisition_value) as total_value
      FROM footballplayers
      WHERE team_id = 'SSPSLT0005'
      AND season_id = 'SSPSLS17'
      AND is_sold = true
    `;
    
    console.log(`   TM Asgardians S17: ${s17Players[0].total} players, ${s17Players[0].total_value} eCoin\n`);

    // Check player_history
    console.log('2️⃣  PLAYER_HISTORY TABLE\n');
    
    const closedHistory = await sql`
      SELECT COUNT(*) as total
      FROM player_history
      WHERE team_id = 'SSPSLT0023'
      AND season_id = 'SSPSLS16'
      AND status = 'takeover'
    `;
    
    const activeHistory = await sql`
      SELECT COUNT(*) as total
      FROM player_history
      WHERE team_id = 'SSPSLT0005'
      AND season_id = 'SSPSLS17'
      AND status = 'active'
      AND acquisition_type = 'takeover'
    `;
    
    console.log(`   Kopites S16 (closed): ${closedHistory[0].total} records`);
    console.log(`   TM Asgardians S17 (active): ${activeHistory[0].total} records\n`);

    // Check starred_players
    console.log('3️⃣  STARRED_PLAYERS TABLE\n');
    
    const starred = await sql`
      SELECT COUNT(*) as total
      FROM starred_players
      WHERE team_id = 'SSPSLT0005'
    `;
    
    console.log(`   TM Asgardians: ${starred[0].total} starred players\n`);

    // Check team_seasons
    console.log('4️⃣  TEAM_SEASONS DOCUMENT\n');
    
    const teamSeasonQuery = await db.collection('team_seasons')
      .where('team_id', '==', 'SSPSLT0005')
      .where('season_id', '==', 'SSPSLS17')
      .get();
    
    if (teamSeasonQuery.size > 0) {
      const data = teamSeasonQuery.docs[0].data();
      console.log(`   Team: ${data.team_name}`);
      console.log(`   Football Budget: ${data.football_budget} eCoin`);
      console.log(`   Real Player Budget: ${data.real_player_budget} SSCoin\n`);
    }

    // Sample players
    console.log('5️⃣  SAMPLE PLAYERS\n');
    
    const samplePlayers = await sql`
      SELECT name, position, acquisition_value
      FROM footballplayers
      WHERE team_id = 'SSPSLT0005'
      AND season_id = 'SSPSLS17'
      ORDER BY acquisition_value DESC
      LIMIT 5
    `;
    
    samplePlayers.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.position}) - ${p.acquisition_value} eCoin`);
    });

    console.log('\n✅ Verification complete!\n');

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  }
}

verifyTakeover()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
