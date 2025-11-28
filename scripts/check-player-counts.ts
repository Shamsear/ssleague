/**
 * Check Player Counts in Both Databases
 * 
 * Checks:
 * 1. Football players count from auction DB (team_players table) - DOES NOT EXIST IN AUCTION DB
 * 2. Real players count from tournament DB (realplayerstats table)
 * 
 * Usage: npx tsx scripts/check-player-counts.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const auctionDbUrl = process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL;
const tournamentDbUrl = process.env.NEON_TOURNAMENT_DB_URL;

if (!auctionDbUrl || !tournamentDbUrl) {
  console.error('❌ Database URLs not set');
  process.exit(1);
}

const auctionDb = neon(auctionDbUrl);
const tournamentDb = neon(tournamentDbUrl);

async function checkPlayerCounts() {
  console.log('🔍 Checking Player Counts in Databases...\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Get active season from Firebase (we'll use a sample season_id for now)
    // In production, you'd fetch this from Firebase
    const sampleSeasonId = 'SSPSLS16'; // Current season

    console.log(`📊 Checking data for season: ${sampleSeasonId}\n`);

    // ============================================
    // 1. CHECK AUCTION DB - team_players table
    // ============================================
    console.log('🎯 AUCTION DB - Checking team_players table...');
    console.log('-'.repeat(80));
    
    try {
      // Check if table exists
      const tableCheck = await auctionDb`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'team_players'
        ) as exists
      `;
      
      if (!tableCheck[0].exists) {
        console.log('⚠️  team_players table DOES NOT EXIST in auction DB');
        console.log('   This table should be in the TOURNAMENT DB, not auction DB\n');
      } else {
        // Get sample data
        const sampleData = await auctionDb`
          SELECT * FROM team_players 
          WHERE season_id = ${sampleSeasonId}
          LIMIT 5
        `;
        
        console.log(`✅ Found ${sampleData.length} sample records`);
        if (sampleData.length > 0) {
          console.log('\nSample record structure:');
          console.log(JSON.stringify(sampleData[0], null, 2));
        }
        
        // Get counts by team
        const teamCounts = await auctionDb`
          SELECT 
            team_id,
            COUNT(*) as player_count
          FROM team_players
          WHERE season_id = ${sampleSeasonId}
          GROUP BY team_id
          ORDER BY player_count DESC
          LIMIT 10
        `;
        
        console.log('\nTop 10 teams by player count:');
        teamCounts.forEach((row: any) => {
          console.log(`  ${row.team_id}: ${row.player_count} players`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking auction DB:', error);
    }
    
    console.log('\n');

    // ============================================
    // 2. CHECK TOURNAMENT DB - player_seasons table (for real players)
    // ============================================
    console.log('👤 TOURNAMENT DB - Checking player_seasons table...');
    console.log('-'.repeat(80));
    
    try {
      // Get sample data
      const sampleData = await tournamentDb`
        SELECT * FROM player_seasons 
        WHERE season_id = ${sampleSeasonId}
        LIMIT 5
      `;
      
      console.log(`✅ Found ${sampleData.length} sample records`);
      if (sampleData.length > 0) {
        console.log('\nSample record structure:');
        console.log(JSON.stringify(sampleData[0], null, 2));
      }
      
      // Get counts by team
      const teamCounts = await tournamentDb`
        SELECT 
          team_id,
          team,
          COUNT(*) as real_player_count
        FROM player_seasons
        WHERE season_id = ${sampleSeasonId}
        GROUP BY team_id, team
        ORDER BY real_player_count DESC
        LIMIT 10
      `;
      
      console.log('\nTop 10 teams by real player count:');
      teamCounts.forEach((row: any) => {
        console.log(`  ${row.team_id} (${row.team}): ${row.real_player_count} real players`);
      });
    } catch (error) {
      console.log('❌ Error checking tournament DB player_seasons:', error);
    }


    console.log('\n' + '='.repeat(80));
    console.log('✅ Check Complete!');
    console.log('='.repeat(80) + '\n');

    // Summary
    console.log('📋 SUMMARY:');
    console.log('   • Football players are in: auction_db.team_players');
    console.log('   • Real players are in: tournament_db.player_seasons');
    console.log('   • Both tables use team_id and season_id for filtering\n');

  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

// Run check
checkPlayerCounts();
