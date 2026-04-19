/**
 * Sync football_budget from Firebase to Neon
 * Only updates budget, does NOT touch spent amounts
 */

const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin using environment variables
if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}-default-rtdb.firebaseio.com`,
      });
      console.log('✅ Firebase Admin initialized\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      console.log(`✅ Firebase Admin initialized with project ID\n`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function syncBudget(dryRun = true) {
  console.log('🔄 Starting budget sync from Firebase to Neon...');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '✍️ LIVE (will update Neon)'}\n`);

  try {
    // Get active season
    const seasonsSnapshot = await db.collection('seasons')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (seasonsSnapshot.empty) {
      console.error('❌ No active season found');
      return;
    }

    const seasonDoc = seasonsSnapshot.docs[0];
    const seasonId = seasonDoc.id;
    const seasonData = seasonDoc.data();
    
    console.log(`📅 Active Season: ${seasonData.name || seasonId}`);
    console.log(`🆔 Season ID: ${seasonId}\n`);

    // Get all team_seasons from Firebase
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('season_id', '==', seasonId)
      .get();

    console.log(`📊 Found ${teamSeasonsSnapshot.size} teams in Firebase\n`);

    // Get all teams from Neon
    const neonTeams = await sql`
      SELECT 
        id,
        name,
        football_budget
      FROM teams
      WHERE season_id = ${seasonId}
    `;

    console.log(`📊 Found ${neonTeams.length} teams in Neon\n`);

    // Create map of Neon teams
    const neonTeamsMap = new Map();
    for (const team of neonTeams) {
      neonTeamsMap.set(team.id, team);
    }

    // Track updates
    const updates = [];
    let matchCount = 0;

    console.log('═'.repeat(80));
    console.log('🔍 CHECKING BUDGET DISCREPANCIES');
    console.log('═'.repeat(80));

    for (const tsDoc of teamSeasonsSnapshot.docs) {
      const tsData = tsDoc.data();
      const teamId = tsData.team_id;
      const teamName = tsData.team_name || 'Unknown';
      
      // Get corresponding Neon team
      const neonTeam = neonTeamsMap.get(teamId);

      if (!neonTeam) {
        console.log(`⚠️ ${teamName} (${teamId}): Not found in Neon - SKIPPING`);
        continue;
      }

      // Get Firebase budget
      const currencySystem = tsData.currency_system || 'single';
      const firebaseBudget = currencySystem === 'dual' 
        ? (tsData.football_budget || 0)
        : (tsData.budget || 0);
      const neonBudget = parseInt(neonTeam.football_budget) || 0;

      // Check if they match
      if (firebaseBudget === neonBudget) {
        matchCount++;
        console.log(`✅ ${teamName}: £${firebaseBudget} (in sync)`);
      } else {
        const diff = firebaseBudget - neonBudget;
        console.log(`\n🔄 ${teamName} (${teamId}):`);
        console.log(`   Firebase: £${firebaseBudget}`);
        console.log(`   Neon:     £${neonBudget}`);
        console.log(`   Diff:     £${diff} ${diff > 0 ? '(Firebase higher)' : '(Neon higher)'}`);
        
        updates.push({
          teamId,
          teamName,
          firebaseBudget,
          neonBudget,
          diff
        });
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📊 SYNC SUMMARY');
    console.log('═'.repeat(80));
    console.log(`✅ Teams already in sync: ${matchCount}`);
    console.log(`🔄 Teams needing update: ${updates.length}\n`);

    if (updates.length === 0) {
      console.log('✅ All teams are already in sync! No updates needed.\n');
      return;
    }

    // Show what will be updated
    console.log('📝 UPDATES TO BE APPLIED:\n');
    for (const update of updates) {
      console.log(`${update.teamName}:`);
      console.log(`  Will update Neon from £${update.neonBudget} → £${update.firebaseBudget}`);
    }

    if (dryRun) {
      console.log('\n' + '═'.repeat(80));
      console.log('🔍 DRY RUN COMPLETE - No changes were made');
      console.log('═'.repeat(80));
      console.log('\nTo apply these changes, run:');
      console.log('  node scripts/sync-budget-firebase-to-neon.js --apply\n');
      return;
    }

    // Apply updates
    console.log('\n' + '═'.repeat(80));
    console.log('✍️ APPLYING UPDATES TO NEON');
    console.log('═'.repeat(80));

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        const result = await sql`
          UPDATE teams
          SET 
            football_budget = ${update.firebaseBudget},
            updated_at = NOW()
          WHERE id = ${update.teamId}
          AND season_id = ${seasonId}
          RETURNING football_budget
        `;

        if (result.length > 0) {
          const newBudget = result[0].football_budget;
          console.log(`✅ ${update.teamName}: Updated to £${newBudget}`);
          successCount++;
        } else {
          console.log(`❌ ${update.teamName}: Update failed (no rows affected)`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ ${update.teamName}: Error - ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('🎉 SYNC COMPLETE');
    console.log('═'.repeat(80));
    console.log(`✅ Successfully updated: ${successCount} teams`);
    console.log(`❌ Failed: ${errorCount} teams`);
    console.log(`📊 Total processed: ${updates.length} teams\n`);

  } catch (error) {
    console.error('❌ Error during sync:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isApply = args.includes('--apply');

// Run the sync
syncBudget(!isApply)
  .then(() => {
    console.log('✅ Budget sync completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Budget sync failed:', error);
    process.exit(1);
  });
