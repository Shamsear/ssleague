const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const fantasyDbUrl = process.env.FANTASY_DATABASE_URL;
  
  if (!fantasyDbUrl) {
    console.error('❌ FANTASY_DATABASE_URL not found in environment');
    process.exit(1);
  }

  const sql = neon(fantasyDbUrl);

  console.log('🚀 Running tier-by-tier draft migrations...\n');

  try {
    // Migration 1: Tier status columns
    console.log('📝 Migration 1: Adding tier status columns...');
    
    // Add tier_status column
    await sql`
      ALTER TABLE fantasy_draft_tiers
      ADD COLUMN IF NOT EXISTS tier_status VARCHAR(20) DEFAULT 'pending' CHECK (tier_status IN ('pending', 'active', 'processing', 'closed'))
    `;
    
    await sql`
      ALTER TABLE fantasy_draft_tiers
      ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ
    `;
    
    await sql`
      ALTER TABLE fantasy_draft_tiers
      ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ
    `;
    
    // Add current_active_tier to fantasy_leagues
    await sql`
      ALTER TABLE fantasy_leagues
      ADD COLUMN IF NOT EXISTS current_active_tier INTEGER
    `;
    
    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_draft_tiers_status 
      ON fantasy_draft_tiers(league_id, tier_status)
    `;
    
    console.log('✅ Tier status columns added successfully\n');

    // Migration 2: Transfer window columns
    console.log('📝 Migration 2: Adding transfer window columns...');
    
    // Check if table exists first
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'fantasy_transfer_windows'
      )
    `;
    
    if (tableExists[0].exists) {
      await sql`
        ALTER TABLE fantasy_transfer_windows
        ADD COLUMN IF NOT EXISTS window_name VARCHAR(200)
      `;
      
      await sql`
        ALTER TABLE fantasy_transfer_windows
        ADD COLUMN IF NOT EXISTS opens_at TIMESTAMP
      `;
      
      await sql`
        ALTER TABLE fantasy_transfer_windows
        ADD COLUMN IF NOT EXISTS closes_at TIMESTAMP
      `;
      
      await sql`
        ALTER TABLE fantasy_transfer_windows
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false
      `;
      
      // Migrate existing data
      await sql`
        UPDATE fantasy_transfer_windows
        SET 
          window_name = COALESCE(window_name, 'Transfer Window ' || id),
          opens_at = COALESCE(opens_at, start_time),
          closes_at = COALESCE(closes_at, end_time),
          is_active = COALESCE(is_active, (status = 'active'))
        WHERE window_name IS NULL OR opens_at IS NULL OR closes_at IS NULL
      `;
      
      // Add constraint
      await sql`
        ALTER TABLE fantasy_transfer_windows
        DROP CONSTRAINT IF EXISTS check_closes_after_opens
      `;
      
      await sql`
        ALTER TABLE fantasy_transfer_windows
        ADD CONSTRAINT check_closes_after_opens CHECK (closes_at > opens_at)
      `;
      
      // Create indexes
      await sql`
        CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_active 
        ON fantasy_transfer_windows(league_id, is_active) 
        WHERE is_active = true
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_timing 
        ON fantasy_transfer_windows(league_id, opens_at, closes_at)
      `;
      
      console.log('✅ Transfer window columns added successfully\n');
    } else {
      console.log('⚠️  fantasy_transfer_windows table does not exist, skipping migration\n');
      console.log('   Run migrations/fantasy_revamp_transfer_tables.sql first to create the table\n');
    }

    // Verify the changes
    console.log('🔍 Verifying migrations...\n');

    // Check tier status columns
    const tierColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fantasy_draft_tiers'
        AND column_name IN ('tier_status', 'opened_at', 'closed_at')
      ORDER BY column_name
    `;
    
    console.log('Tier status columns:');
    tierColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check league active tier column
    const leagueColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fantasy_leagues'
        AND column_name = 'current_active_tier'
    `;
    
    console.log('\nLeague active tier column:');
    leagueColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check transfer window columns
    const windowColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fantasy_transfer_windows'
        AND column_name IN ('window_name', 'opens_at', 'closes_at', 'is_active')
      ORDER BY column_name
    `;
    
    console.log('\nTransfer window columns:');
    windowColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✅ All migrations completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Tier status tracking enabled');
    console.log('  - Transfer window management enabled');
    console.log('  - Ready for tier-by-tier draft system');
    console.log('  - Ready for transfer window management');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
