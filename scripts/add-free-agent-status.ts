/**
 * Migration Script: Add free_agent status to all registered players
 * 
 * This script updates all player records in the `player_seasons` table (Neon PostgreSQL)
 * to include a `status` field set to 'free_agent' if they don't already have one.
 * 
 * Run with: npx tsx scripts/add-free-agent-status.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Neon PostgreSQL connection (Tournament DB)
const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

interface PlayerSeason {
  player_id: string;
  season_id: string;
  player_name?: string;
  status?: string;
  team_id?: string;
  [key: string]: any;
}

async function addFreeAgentStatus() {
  console.log('🚀 Starting migration: Add free_agent status to registered players\n');
  
  try {
    // Step 1: Add status column if it doesn't exist
    console.log('🔧 Checking if status column exists...');
    try {
      await sql`
        ALTER TABLE player_seasons 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50)
      `;
      console.log('✅ Status column ensured in player_seasons table\n');
    } catch (error) {
      console.error('❌ Error adding status column:', error);
      throw error;
    }
    
    // Step 2: Fetch all player records from player_seasons table
    console.log('📥 Fetching all players from player_seasons table...');
    const result = await sql<PlayerSeason>`
      SELECT player_id, season_id, player_name, status, team_id 
      FROM player_seasons 
      ORDER BY player_id, season_id
    `;
    
    console.log(`📊 Found ${result.length} player season records\n`);
    
    if (result.length === 0) {
      console.log('⚠️  No players found in player_seasons table');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const player of result) {
      const playerName = player.player_name || player.player_id;
      const identifier = `${playerName} (${player.player_id} - ${player.season_id})`;
      
      // Skip if already has a status field
      if (player.status) {
        console.log(`⏭️  Skipping ${identifier} - Already has status: ${player.status}`);
        skippedCount++;
        continue;
      }

      // Add status field
      try {
        await sql`
          UPDATE player_seasons 
          SET status = ${'free_agent'}, updated_at = NOW() 
          WHERE player_id = ${player.player_id} AND season_id = ${player.season_id}
        `;
        
        updatedCount++;
        console.log(`✅ Updated ${identifier} with free_agent status`);
      } catch (error) {
        console.error(`❌ Error processing ${identifier}:`, error);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Updated:  ${updatedCount} player season records`);
    console.log(`⏭️  Skipped:  ${skippedCount} player season records (already had status)`);
    console.log(`❌ Errors:   ${errorCount} player season records`);
    console.log(`📊 Total:    ${result.length} player season records`);
    console.log('='.repeat(60) + '\n');

    if (errorCount === 0 && updatedCount > 0) {
      console.log('🎉 Migration completed successfully!');
    } else if (errorCount > 0) {
      console.log('⚠️  Migration completed with errors. Please review the logs above.');
    } else {
      console.log('ℹ️  No updates were needed.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
addFreeAgentStatus()
  .then(() => {
    console.log('\n✅ Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
