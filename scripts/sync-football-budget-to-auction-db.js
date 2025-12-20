/**
 * Sync football_player_budget from Firebase team_seasons to Auction DB teams table
 * 
 * This ensures the auction database has the correct budget values
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

async function syncFootballBudgets() {
  try {
    console.log('🔍 Fetching all team_seasons from Firebase...\n');
    
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('status', '==', 'registered')
      .get();
    
    console.log(`Found ${teamSeasonsSnapshot.size} registered team_seasons\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const doc of teamSeasonsSnapshot.docs) {
      const data = doc.data();
      const teamId = data.team_id;
      const teamName = data.team_name;
      const seasonId = data.season_id;
      const footballBudget = data.football_budget || 0;
      
      console.log(`\n📋 Processing: ${teamName} (${teamId})`);
      console.log(`   Season: ${seasonId}`);
      console.log(`   Football Budget: ${footballBudget}`);
      
      try {
        // Check if team exists in auction DB
        const existingTeam = await auctionSql`
          SELECT id, football_budget
          FROM teams
          WHERE id = ${teamId}
          LIMIT 1
        `;
        
        if (existingTeam.length === 0) {
          console.log(`   ⚠️  Team not found in auction DB - SKIPPING`);
          skipped++;
          continue;
        }
        
        const currentBudget = parseFloat(existingTeam[0].football_budget) || 0;
        
        if (currentBudget === footballBudget) {
          console.log(`   ✓ Already in sync (${currentBudget})`);
          skipped++;
          continue;
        }
        
        // Update the budget
        await auctionSql`
          UPDATE teams
          SET 
            football_budget = ${footballBudget},
            updated_at = NOW()
          WHERE id = ${teamId}
        `;
        
        console.log(`   ✅ Updated: ${currentBudget} → ${footballBudget}`);
        updated++;
        
      } catch (error) {
        console.error(`   ❌ Error updating ${teamName}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n\n📊 SYNC SUMMARY`);
    console.log(`   ✅ Updated: ${updated} teams`);
    console.log(`   ⏭️  Skipped: ${skipped} teams (already in sync or not found)`);
    console.log(`   ❌ Errors: ${errors} teams`);
    console.log(`\n✅ COMPLETE!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

syncFootballBudgets();
