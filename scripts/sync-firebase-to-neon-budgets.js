require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');

// Use AUCTION database URL for teams
const auctionSql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized\n');
}

const db = admin.firestore();

async function syncBudgets() {
  try {
    const seasonId = process.argv[2] || 'SSPSLS16';
    console.log(`🔄 Syncing team budgets from Firebase to Neon for season ${seasonId}\n`);

    // Get all team_seasons from Firebase
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    
    const teamsToSync = [];
    teamSeasonsSnapshot.forEach(doc => {
      const data = doc.data();
      // Match pattern: teamId_seasonId
      if (doc.id.endsWith(`_${seasonId}`)) {
        teamsToSync.push({
          team_id: data.team_id,
          team_name: data.team_name || data.team_id,
          football_budget: data.football_budget || 0,
          real_player_budget: data.real_player_budget || 0
        });
      }
    });

    console.log(`Found ${teamsToSync.length} teams to sync\n`);
    console.log('═'.repeat(80));

    let successCount = 0;
    let errorCount = 0;

    for (const team of teamsToSync) {
      try {
        console.log(`\n📊 ${team.team_name} (${team.team_id})`);
        console.log(`   Firebase: ${team.football_budget} eCoin, ${team.real_player_budget} SSCoin`);

        // Get current Neon values
        const neonTeam = await auctionSql`
          SELECT football_budget
          FROM teams
          WHERE id = ${team.team_id}
          LIMIT 1
        `;

        if (neonTeam.length === 0) {
          console.log(`   ⚠️  Team not found in Neon database`);
          errorCount++;
          continue;
        }

        const currentNeonFootball = neonTeam[0].football_budget || 0;

        console.log(`   Neon (before): ${currentNeonFootball} eCoin`);

        // Update Neon to match Firebase (only football_budget, SSCoin stays in Firebase only)
        await auctionSql`
          UPDATE teams
          SET 
            football_budget = ${team.football_budget},
            updated_at = NOW()
          WHERE id = ${team.team_id}
        `;

        console.log(`   ✅ Synced to Neon: ${team.football_budget} eCoin`);
        console.log(`   ℹ️  SSCoin (${team.real_player_budget}) remains in Firebase only`);
        
        const diff_football = team.football_budget - currentNeonFootball;
        
        if (diff_football !== 0) {
          console.log(`   📈 Difference: ${diff_football > 0 ? '+' : ''}${diff_football} eCoin`);
        } else {
          console.log(`   ℹ️  Already in sync`);
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Error syncing ${team.team_id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`\n✅ Sync complete!`);
    console.log(`   Success: ${successCount} teams`);
    console.log(`   Errors: ${errorCount} teams`);
    console.log(`   Total: ${successCount + errorCount} teams`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

syncBudgets()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
