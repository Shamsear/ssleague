/**
 * PHASE 1: Multi-Tournament Architecture Migration
 * 
 * This script transforms the database from single-tournament-per-season
 * to multi-tournament-per-season architecture.
 * 
 * IMPORTANT: This is a MAJOR migration. Backup your data before running!
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config({ path: '.env.local' });

async function migrateToMultiTournament() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🚀 Starting Multi-Tournament Architecture Migration');
  console.log('================================================\n');

  try {
    // ========================================
    // STEP 1: Create tournaments table
    // ========================================
    console.log('📊 Step 1/7: Creating tournaments table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        season_id TEXT NOT NULL,
        tournament_type TEXT NOT NULL CHECK (tournament_type IN ('league', 'cup', 'ucl', 'uel', 'super_cup', 'league_cup')),
        tournament_name TEXT NOT NULL,
        tournament_code TEXT,
        status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        description TEXT,
        is_primary BOOLEAN DEFAULT false,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(season_id, tournament_type)
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_tournaments_season ON tournaments(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournaments_type ON tournaments(tournament_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status)`;

    console.log('✅ Tournaments table created\n');

    // ========================================
    // STEP 2: Add tournament_id to fixtures
    // ========================================
    console.log('📊 Step 2/7: Adding tournament_id to fixtures...');
    
    await sql`ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS tournament_id TEXT`;
    
    console.log('✅ Column added to fixtures\n');

    // ========================================
    // STEP 3: Add tournament_id to realplayerstats
    // ========================================
    console.log('📊 Step 3/7: Adding tournament_id to realplayerstats...');
    
    await sql`ALTER TABLE realplayerstats ADD COLUMN IF NOT EXISTS tournament_id TEXT`;
    
    console.log('✅ Column added to realplayerstats\n');

    // ========================================
    // STEP 4: Add tournament_id to teamstats
    // ========================================
    console.log('📊 Step 4/7: Adding tournament_id to teamstats...');
    
    await sql`ALTER TABLE teamstats ADD COLUMN IF NOT EXISTS tournament_id TEXT`;
    
    console.log('✅ Column added to teamstats\n');

    // ========================================
    // STEP 5: Add tournament_id to matchups
    // ========================================
    console.log('📊 Step 5/7: Adding tournament_id to matchups...');
    
    await sql`ALTER TABLE matchups ADD COLUMN IF NOT EXISTS tournament_id TEXT`;
    
    console.log('✅ Column added to matchups\n');

    // ========================================
    // STEP 6: Add tournament_id to fixture_audit_log
    // ========================================
    console.log('📊 Step 6/7: Adding tournament_id to fixture_audit_log...');
    
    await sql`ALTER TABLE fixture_audit_log ADD COLUMN IF NOT EXISTS tournament_id TEXT`;
    
    console.log('✅ Column added to fixture_audit_log\n');

    // ========================================
    // STEP 7: Modify tournament_settings primary key
    // ========================================
    console.log('📊 Step 7/7: Updating tournament_settings...');
    
    // Add tournament_id column first
    await sql`ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS tournament_id TEXT`;
    
    console.log('✅ Migration structure complete\n');

    console.log('================================================');
    console.log('✨ Phase 1 Migration Complete!');
    console.log('================================================\n');
    
    console.log('⚠️  NEXT STEPS:');
    console.log('1. Run script 02-migrate-existing-data.ts to populate tournament_id');
    console.log('2. Run script 03-add-constraints.ts to add foreign keys and indexes');
    console.log('3. Update API routes to use tournament_id');
    console.log('4. Update frontend components\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrateToMultiTournament()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
