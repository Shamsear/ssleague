/**
 * Verification Script: Check position_counts in team_seasons
 * 
 * This script verifies that all team_seasons documents have correct football positions
 * 
 * Run with: node scripts/verify-position-counts.js
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
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
      });
      console.log('✅ Firebase Admin initialized\n');
    } else if (projectId) {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}\n`);
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

const FOOTBALL_POSITIONS = [
  'GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'
];

const CRICKET_POSITIONS = ['batsman', 'bowler', 'wicket_keeper', 'all_rounder'];

async function verifyPositionCounts() {
  console.log('🔍 Verifying position_counts in team_seasons...\n');

  try {
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    
    console.log(`📊 Found ${teamSeasonsSnapshot.size} team_seasons documents\n`);

    let correctCount = 0;
    let incorrectCount = 0;

    for (const doc of teamSeasonsSnapshot.docs) {
      const teamSeasonId = doc.id;
      const data = doc.data();
      const teamName = data.team_name || teamSeasonId;

      console.log(`\n📝 ${teamName} (${teamSeasonId})`);

      const positionCounts = data.position_counts || {};
      
      // Check for football positions
      const hasAllFootballPositions = FOOTBALL_POSITIONS.every(
        pos => pos in positionCounts
      );
      
      // Check for cricket positions
      const hasCricketPositions = CRICKET_POSITIONS.some(
        pos => pos in positionCounts
      );

      if (hasAllFootballPositions && !hasCricketPositions) {
        console.log('   ✅ Correct: Has all football positions, no cricket positions');
        console.log('   Position Counts:', JSON.stringify(positionCounts, null, 2).split('\n').map(line => '      ' + line).join('\n').trim());
        correctCount++;
      } else {
        console.log('   ❌ Incorrect: Missing football positions or has cricket positions');
        console.log('   Has all football positions:', hasAllFootballPositions);
        console.log('   Has cricket positions:', hasCricketPositions);
        console.log('   Position Counts:', JSON.stringify(positionCounts, null, 2).split('\n').map(line => '      ' + line).join('\n').trim());
        incorrectCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Verification Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Correct: ${correctCount}`);
    console.log(`❌ Incorrect: ${incorrectCount}`);
    console.log(`📝 Total: ${teamSeasonsSnapshot.size}`);
    console.log('='.repeat(60));

    if (incorrectCount === 0) {
      console.log('\n✨ All team_seasons documents have correct position_counts!\n');
    } else {
      console.log('\n⚠️  Some team_seasons documents need fixing!\n');
    }

  } catch (error) {
    console.error('❌ Fatal error during verification:', error);
    process.exit(1);
  }
}

// Run the verification
verifyPositionCounts()
  .then(() => {
    console.log('👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
