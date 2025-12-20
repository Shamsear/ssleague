/**
 * PREVIEW: Check football_player_budget mismatches between Firebase and Auction DB
 * 
 * This script only reports differences without making any changes
 */

const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

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
    console.log('✅ Firebase Admin initialized\n');
  } else {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials\n');
  }
}

const db = admin.firestore();
const auctionSql = neon(process.env.NEON_AUCTION_DB_URL);

async function previewFootballBudgets() {
  try {
    console.log('🔍 PREVIEW MODE - No changes will be made\n');
    console.log('📋 Fetching team_seasons for Season 16 (SSPSLS16) from Firebase...\n');
    
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('status', '==', 'registered')
      .where('season_id', '==', 'SSPSLS16')
      .get();
    
    console.log(`Found ${teamSeasonsSnapshot.size} registered team_seasons\n`);
    console.log('═'.repeat(80));
    
    const mismatches = [];
    const matches = [];
    const notFound = [];
    const errors = [];
    
    for (const doc of teamSeasonsSnapshot.docs) {
      const data = doc.data();
      const teamId = data.team_id;
      const teamName = data.team_name;
      const seasonId = data.season_id;
      const firebaseBudget = data.football_budget || 0;
      
      try {
        // Check if team exists in auction DB
        const existingTeam = await auctionSql`
          SELECT id, football_budget
          FROM teams
          WHERE id = ${teamId}
          LIMIT 1
        `;
        
        if (existingTeam.length === 0) {
          notFound.push({
            teamId,
            teamName,
            seasonId,
            firebaseBudget
          });
          continue;
        }
        
        const auctionBudget = parseFloat(existingTeam[0].football_budget) || 0;
        
        if (auctionBudget !== firebaseBudget) {
          mismatches.push({
            teamId,
            teamName,
            seasonId,
            firebaseBudget,
            auctionBudget,
            difference: firebaseBudget - auctionBudget
          });
        } else {
          matches.push({
            teamId,
            teamName,
            budget: firebaseBudget
          });
        }
        
      } catch (error) {
        errors.push({
          teamId,
          teamName,
          error: error.message
        });
      }
    }
    
    // Display results
    console.log('\n\n📊 PREVIEW RESULTS\n');
    console.log('═'.repeat(80));
    
    if (mismatches.length > 0) {
      console.log(`\n⚠️  MISMATCHES FOUND: ${mismatches.length} teams\n`);
      console.log('These teams will be updated:\n');
      
      mismatches.forEach(m => {
        console.log(`📋 ${m.teamName} (${m.teamId})`);
        console.log(`   Season: ${m.seasonId}`);
        console.log(`   Firebase: ${m.firebaseBudget.toFixed(2)}`);
        console.log(`   Auction DB: ${m.auctionBudget.toFixed(2)}`);
        console.log(`   Difference: ${m.difference > 0 ? '+' : ''}${m.difference.toFixed(2)}`);
        console.log(`   Action: UPDATE auction DB to ${m.firebaseBudget.toFixed(2)}`);
        console.log('');
      });
      
      console.log('─'.repeat(80));
      console.log(`Total to update: ${mismatches.length} teams`);
      console.log('─'.repeat(80));
    } else {
      console.log('\n✅ NO MISMATCHES - All budgets are in sync!\n');
    }
    
    if (matches.length > 0) {
      console.log(`\n✓ IN SYNC: ${matches.length} teams`);
      matches.forEach(m => {
        console.log(`   ${m.teamName}: ${m.budget.toFixed(2)}`);
      });
    }
    
    if (notFound.length > 0) {
      console.log(`\n⚠️  NOT FOUND IN AUCTION DB: ${notFound.length} teams`);
      notFound.forEach(nf => {
        console.log(`   ${nf.teamName} (${nf.teamId}) - Season: ${nf.seasonId}`);
      });
    }
    
    if (errors.length > 0) {
      console.log(`\n❌ ERRORS: ${errors.length} teams`);
      errors.forEach(e => {
        console.log(`   ${e.teamName} (${e.teamId}): ${e.error}`);
      });
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n📝 SUMMARY:');
    console.log(`   ⚠️  Mismatches: ${mismatches.length}`);
    console.log(`   ✓ In Sync: ${matches.length}`);
    console.log(`   ⚠️  Not Found: ${notFound.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    console.log(`   📊 Total: ${teamSeasonsSnapshot.size}`);
    
    if (mismatches.length > 0) {
      console.log('\n💡 To apply these changes, run:');
      console.log('   node scripts/sync-football-budget-to-auction-db.js');
    }
    
    console.log('\n✅ PREVIEW COMPLETE - No changes were made\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

previewFootballBudgets();
