/**
 * Migration Script: Fix position_counts in team_seasons
 * 
 * This script updates all team_seasons documents to:
 * 1. Replace cricket positions with football positions
 * 2. Recalculate position counts based on actual players owned
 * 
 * Run with: npx ts-node scripts/migrate-position-counts.ts
 */

import { neon } from '@neondatabase/serverless';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

// Football positions mapping
const FOOTBALL_POSITIONS = [
  'GK',   // Goalkeeper
  'CB',   // Center Back
  'LB',   // Left Back
  'RB',   // Right Back
  'DMF',  // Defensive Midfielder
  'CMF',  // Center Midfielder
  'AMF',  // Attacking Midfielder
  'LMF',  // Left Midfielder
  'RMF',  // Right Midfielder
  'LWF',  // Left Wing Forward
  'RWF',  // Right Wing Forward
  'SS',   // Second Striker
  'CF',   // Center Forward
];

interface PositionCounts {
  [key: string]: number;
}

async function getTeamPlayerPositions(teamId: string, seasonId: string): Promise<PositionCounts> {
  try {
    // Query team_players joined with footballplayers to get positions
    const result = await sql`
      SELECT p.position, COUNT(*) as count
      FROM team_players tp
      INNER JOIN footballplayers p ON tp.player_id = p.id
      WHERE tp.team_id = ${teamId}
      AND p.season_id = ${seasonId}
      GROUP BY p.position
    `;

    const positionCounts: PositionCounts = {};
    
    // Initialize all positions to 0
    FOOTBALL_POSITIONS.forEach(pos => {
      positionCounts[pos] = 0;
    });

    // Fill in actual counts
    result.forEach((row: any) => {
      const position = row.position;
      const count = parseInt(row.count, 10);
      
      if (position && FOOTBALL_POSITIONS.includes(position)) {
        positionCounts[position] = count;
      }
    });

    return positionCounts;
  } catch (error) {
    console.error(`Error getting player positions for team ${teamId}:`, error);
    // Return initialized counts with zeros
    const positionCounts: PositionCounts = {};
    FOOTBALL_POSITIONS.forEach(pos => {
      positionCounts[pos] = 0;
    });
    return positionCounts;
  }
}

async function migrateTeamSeasons() {
  console.log('🚀 Starting position_counts migration...\n');

  try {
    // Get all team_seasons documents
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    
    console.log(`📊 Found ${teamSeasonsSnapshot.size} team_seasons documents\n`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const doc of teamSeasonsSnapshot.docs) {
      const teamSeasonId = doc.id;
      const data = doc.data();
      const teamId = data.team_id;
      const seasonId = data.season_id;
      const teamName = data.team_name || teamId;

      console.log(`\n📝 Processing: ${teamName} (${teamSeasonId})`);
      console.log(`   Team ID: ${teamId}`);
      console.log(`   Season ID: ${seasonId}`);

      try {
        // Check if already has correct format (all football positions exist)
        const currentPositionCounts = data.position_counts || {};
        const hasFootballPositions = FOOTBALL_POSITIONS.every(
          pos => pos in currentPositionCounts
        );
        const hasCricketPositions = 
          'batsman' in currentPositionCounts ||
          'bowler' in currentPositionCounts ||
          'wicket_keeper' in currentPositionCounts ||
          'all_rounder' in currentPositionCounts;

        if (hasFootballPositions && !hasCricketPositions) {
          console.log(`   ✅ Already has correct football positions, recalculating counts...`);
        } else if (hasCricketPositions) {
          console.log(`   🔄 Has cricket positions, migrating to football...`);
        } else {
          console.log(`   ⚠️  Has partial data, fixing...`);
        }

        // Get actual position counts from database
        const calculatedPositionCounts = await getTeamPlayerPositions(teamId, seasonId);
        
        // Calculate total from position counts
        const totalFromPositions = Object.values(calculatedPositionCounts).reduce(
          (sum, count) => sum + count,
          0
        );

        console.log(`   📊 Calculated position counts:`, calculatedPositionCounts);
        console.log(`   👥 Total players from positions: ${totalFromPositions}`);
        console.log(`   👥 Current players_count: ${data.players_count || 0}`);

        // Update the document
        await doc.ref.update({
          position_counts: calculatedPositionCounts,
          players_count: totalFromPositions, // Ensure this matches
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`   ✅ Successfully updated ${teamName}`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error updating ${teamName}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📝 Total processed: ${teamSeasonsSnapshot.size}`);
    console.log('='.repeat(60));
    console.log('\n✨ Migration completed!\n');

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateTeamSeasons()
  .then(() => {
    console.log('👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
