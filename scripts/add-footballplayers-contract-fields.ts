/**
 * Migration Script: Add contract and status fields to footballplayers table
 * 
 * This script adds the same contract management fields that player_seasons has:
 * - contract_id
 * - contract_start_season
 * - contract_end_season
 * - contract_length
 * - status
 * - is_auto_registered
 * 
 * Run with: npx tsx scripts/add-footballplayers-contract-fields.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL!);

async function addContractFields() {
  console.log('🚀 Starting migration: Add contract fields to footballplayers table\n');
  
  try {
    // Add contract-related columns
    console.log('🔧 Adding contract management fields...');
    
    await sql`
      ALTER TABLE footballplayers 
      ADD COLUMN IF NOT EXISTS contract_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS contract_start_season VARCHAR(20),
      ADD COLUMN IF NOT EXISTS contract_end_season VARCHAR(20),
      ADD COLUMN IF NOT EXISTS contract_length INTEGER DEFAULT 2,
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'free_agent',
      ADD COLUMN IF NOT EXISTS is_auto_registered BOOLEAN DEFAULT false
    `;
    
    console.log('✅ Contract fields added successfully\n');
    
    // Check current data
    console.log('📊 Checking existing footballplayers records...');
    const players = await sql`
      SELECT COUNT(*) as count, 
             COUNT(team_id) FILTER (WHERE team_id IS NOT NULL) as assigned_count
      FROM footballplayers
    `;
    
    console.log(`Total players: ${players[0].count}`);
    console.log(`Players with teams: ${players[0].assigned_count}\n`);
    
    // Update status for players with teams
    if (players[0].assigned_count > 0) {
      console.log('🔄 Updating status for players assigned to teams...');
      const result = await sql`
        UPDATE footballplayers
        SET status = 'active'
        WHERE team_id IS NOT NULL AND (status IS NULL OR status = 'free_agent')
      `;
      
      console.log(`✅ Updated status to 'active' for assigned players\n`);
    }
    
    // Set free_agent status for unassigned players
    console.log('🔄 Setting free_agent status for unassigned players...');
    await sql`
      UPDATE footballplayers
      SET status = 'free_agent'
      WHERE team_id IS NULL AND status IS NULL
    `;
    
    console.log('✅ Migration completed successfully!\n');
    
    // Summary
    console.log('='.repeat(60));
    console.log('📋 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Added fields:');
    console.log('   - contract_id');
    console.log('   - contract_start_season');
    console.log('   - contract_end_season');
    console.log('   - contract_length');
    console.log('   - status');
    console.log('   - is_auto_registered');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

addContractFields()
  .then(() => {
    console.log('\n✅ Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
