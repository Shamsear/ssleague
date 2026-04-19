/**
 * Check for discrepancies between Firebase team_seasons and Neon teams table
 * Compares football_budget, football_spent, and slot data
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
      console.log('✅ Firebase Admin initialized with service account\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
    } else {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials\n');
    }
  } catch (error) {
    console.error('❌ Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

// Initialize Neon
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkBudgetSync() {
  console.log('🔍 Starting budget sync check...\n');

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
        firebase_uid,
        football_budget,
        football_spent,
        football_players_count,
        football_base_slots,
        football_purchased_slots,
        football_total_slots
      FROM teams
      WHERE season_id = ${seasonId}
    `;

    console.log(`📊 Found ${neonTeams.length} teams in Neon\n`);

    // Create map of Neon teams by team_id
    const neonTeamsMap = new Map();
    for (const team of neonTeams) {
      neonTeamsMap.set(team.id, team);
    }

    // Compare each team
    const discrepancies = [];
    let matchCount = 0;

    for (const tsDoc of teamSeasonsSnapshot.docs) {
      const tsData = tsDoc.data();
      const teamId = tsData.team_id;
      const teamName = tsData.team_name || 'Unknown';
      
      // Get corresponding Neon team
      const neonTeam = neonTeamsMap.get(teamId);

      if (!neonTeam) {
        discrepancies.push({
          teamId,
          teamName,
          issue: 'MISSING_IN_NEON',
          firebase: tsData,
          neon: null
        });
        continue;
      }

      // Compare budgets
      const currencySystem = tsData.currency_system || 'single';
      const firebaseBudget = currencySystem === 'dual' 
        ? (tsData.football_budget || 0)
        : (tsData.budget || 0);
      const neonBudget = parseInt(neonTeam.football_budget) || 0;

      const firebaseSpent = currencySystem === 'dual'
        ? (tsData.football_spent || 0)
        : (tsData.total_spent || 0);
      const neonSpent = parseInt(neonTeam.football_spent) || 0;

      const firebasePurchasedSlots = tsData.football_purchased_slots || 0;
      const neonPurchasedSlots = parseInt(neonTeam.football_purchased_slots) || 0;

      const firebaseTotalSlots = tsData.football_total_slots || 25;
      const neonTotalSlots = parseInt(neonTeam.football_total_slots) || 25;

      // Check for discrepancies
      const budgetMatch = firebaseBudget === neonBudget;
      const spentMatch = firebaseSpent === neonSpent;
      const slotsMatch = firebasePurchasedSlots === neonPurchasedSlots && firebaseTotalSlots === neonTotalSlots;

      if (budgetMatch && spentMatch && slotsMatch) {
        matchCount++;
      } else {
        discrepancies.push({
          teamId,
          teamName,
          issue: 'MISMATCH',
          currencySystem,
          budget: {
            firebase: firebaseBudget,
            neon: neonBudget,
            match: budgetMatch,
            diff: firebaseBudget - neonBudget
          },
          spent: {
            firebase: firebaseSpent,
            neon: neonSpent,
            match: spentMatch,
            diff: firebaseSpent - neonSpent
          },
          purchasedSlots: {
            firebase: firebasePurchasedSlots,
            neon: neonPurchasedSlots,
            match: firebasePurchasedSlots === neonPurchasedSlots
          },
          totalSlots: {
            firebase: firebaseTotalSlots,
            neon: neonTotalSlots,
            match: firebaseTotalSlots === neonTotalSlots
          }
        });
      }
    }

    // Report results
    console.log('═'.repeat(80));
    console.log('📋 SYNC CHECK RESULTS');
    console.log('═'.repeat(80));
    console.log(`✅ Teams in sync: ${matchCount}`);
    console.log(`❌ Teams with discrepancies: ${discrepancies.length}\n`);

    if (discrepancies.length > 0) {
      console.log('🔴 DISCREPANCIES FOUND:\n');

      for (const disc of discrepancies) {
        console.log('─'.repeat(80));
        console.log(`Team: ${disc.teamName} (${disc.teamId})`);
        
        if (disc.issue === 'MISSING_IN_NEON') {
          console.log('❌ Issue: Team exists in Firebase but NOT in Neon');
        } else {
          console.log(`Currency System: ${disc.currencySystem}`);
          
          if (!disc.budget.match) {
            console.log(`\n💰 BUDGET MISMATCH:`);
            console.log(`   Firebase: £${disc.budget.firebase}`);
            console.log(`   Neon:     £${disc.budget.neon}`);
            console.log(`   Diff:     £${disc.budget.diff} ${disc.budget.diff > 0 ? '(Firebase higher)' : '(Neon higher)'}`);
          }
          
          if (!disc.spent.match) {
            console.log(`\n💸 SPENT MISMATCH:`);
            console.log(`   Firebase: £${disc.spent.firebase}`);
            console.log(`   Neon:     £${disc.spent.neon}`);
            console.log(`   Diff:     £${disc.spent.diff} ${disc.spent.diff > 0 ? '(Firebase higher)' : '(Neon higher)'}`);
          }
          
          if (!disc.purchasedSlots.match) {
            console.log(`\n🎯 PURCHASED SLOTS MISMATCH:`);
            console.log(`   Firebase: ${disc.purchasedSlots.firebase}`);
            console.log(`   Neon:     ${disc.purchasedSlots.neon}`);
          }
          
          if (!disc.totalSlots.match) {
            console.log(`\n📊 TOTAL SLOTS MISMATCH:`);
            console.log(`   Firebase: ${disc.totalSlots.firebase}`);
            console.log(`   Neon:     ${disc.totalSlots.neon}`);
          }
        }
        console.log('');
      }

      console.log('═'.repeat(80));
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('1. Review the discrepancies above');
      console.log('2. Determine which source is correct (usually Firebase is source of truth)');
      console.log('3. Run sync script to fix discrepancies if needed');
      console.log('4. Check for concurrent update issues or missing transaction logs\n');
    } else {
      console.log('✅ All teams are in perfect sync!\n');
    }

    // Summary statistics
    console.log('═'.repeat(80));
    console.log('📊 SUMMARY STATISTICS');
    console.log('═'.repeat(80));
    
    const totalBudgetFirebase = teamSeasonsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      const currencySystem = data.currency_system || 'single';
      const budget = currencySystem === 'dual' ? (data.football_budget || 0) : (data.budget || 0);
      return sum + budget;
    }, 0);

    const totalBudgetNeon = neonTeams.reduce((sum, team) => {
      return sum + (parseInt(team.football_budget) || 0);
    }, 0);

    const totalSpentFirebase = teamSeasonsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      const currencySystem = data.currency_system || 'single';
      const spent = currencySystem === 'dual' ? (data.football_spent || 0) : (data.total_spent || 0);
      return sum + spent;
    }, 0);

    const totalSpentNeon = neonTeams.reduce((sum, team) => {
      return sum + (parseInt(team.football_spent) || 0);
    }, 0);

    console.log(`Total Budget (Firebase): £${totalBudgetFirebase}`);
    console.log(`Total Budget (Neon):     £${totalBudgetNeon}`);
    console.log(`Difference:              £${totalBudgetFirebase - totalBudgetNeon}\n`);

    console.log(`Total Spent (Firebase):  £${totalSpentFirebase}`);
    console.log(`Total Spent (Neon):      £${totalSpentNeon}`);
    console.log(`Difference:              £${totalSpentFirebase - totalSpentNeon}\n`);

  } catch (error) {
    console.error('❌ Error during sync check:', error);
    throw error;
  }
}

// Run the check
checkBudgetSync()
  .then(() => {
    console.log('✅ Budget sync check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Budget sync check failed:', error);
    process.exit(1);
  });
