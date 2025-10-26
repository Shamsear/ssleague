/**
 * PHASE 3: Add Constraints and Indexes
 * 
 * This script adds NOT NULL constraints, foreign keys, and indexes
 * after data has been migrated.
 * 
 * Run this AFTER 02-migrate-existing-data.ts
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config({ path: '.env.local' });

async function addConstraints() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🚀 Starting Constraints and Indexes Migration');
  console.log('=============================================\n');

  try {
    // ========================================
    // STEP 1: Make tournament_id NOT NULL
    // ========================================
    console.log('📊 Step 1/4: Setting NOT NULL constraints...');
    
    await sql`ALTER TABLE fixtures ALTER COLUMN tournament_id SET NOT NULL`;
    console.log('  ✅ fixtures.tournament_id NOT NULL');
    
    await sql`ALTER TABLE realplayerstats ALTER COLUMN tournament_id SET NOT NULL`;
    console.log('  ✅ realplayerstats.tournament_id NOT NULL');
    
    await sql`ALTER TABLE teamstats ALTER COLUMN tournament_id SET NOT NULL`;
    console.log('  ✅ teamstats.tournament_id NOT NULL');
    
    await sql`ALTER TABLE tournament_settings ALTER COLUMN tournament_id SET NOT NULL`;
    console.log('  ✅ tournament_settings.tournament_id NOT NULL\n');

    // ========================================
    // STEP 2: Update Primary Keys
    // ========================================
    console.log('📊 Step 2/4: Updating primary keys...');
    
    // Update tournament_settings primary key
    await sql`ALTER TABLE tournament_settings DROP CONSTRAINT IF EXISTS tournament_settings_pkey`;
    await sql`ALTER TABLE tournament_settings ADD PRIMARY KEY (tournament_id)`;
    console.log('  ✅ tournament_settings primary key updated');
    
    // Update realplayerstats primary key (composite with tournament_id)
    await sql`ALTER TABLE realplayerstats DROP CONSTRAINT IF EXISTS realplayerstats_pkey`;
    await sql`ALTER TABLE realplayerstats ADD PRIMARY KEY (player_id, tournament_id)`;
    console.log('  ✅ realplayerstats primary key updated');
    
    // Update teamstats primary key (composite with tournament_id)
    await sql`ALTER TABLE teamstats DROP CONSTRAINT IF EXISTS teamstats_pkey`;
    await sql`ALTER TABLE teamstats ADD PRIMARY KEY (team_id, tournament_id)`;
    console.log('  ✅ teamstats primary key updated\n');

    // ========================================
    // STEP 3: Add Foreign Keys
    // ========================================
    console.log('📊 Step 3/4: Adding foreign key constraints...');
    
    try {
      await sql`
        ALTER TABLE fixtures 
        ADD CONSTRAINT fk_fixtures_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
        ON DELETE CASCADE
      `;
      console.log('  ✅ fixtures → tournaments FK added');
    } catch (e: any) {
      if (e.code === '42710') console.log('  ⚠️  fixtures FK already exists');
      else throw e;
    }
    
    try {
      await sql`
        ALTER TABLE realplayerstats
        ADD CONSTRAINT fk_realplayerstats_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
        ON DELETE CASCADE
      `;
      console.log('  ✅ realplayerstats → tournaments FK added');
    } catch (e: any) {
      if (e.code === '42710') console.log('  ⚠️  realplayerstats FK already exists');
      else throw e;
    }
    
    try {
      await sql`
        ALTER TABLE teamstats
        ADD CONSTRAINT fk_teamstats_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
        ON DELETE CASCADE
      `;
      console.log('  ✅ teamstats → tournaments FK added');
    } catch (e: any) {
      if (e.code === '42710') console.log('  ⚠️  teamstats FK already exists');
      else throw e;
    }
    
    try {
      await sql`
        ALTER TABLE tournament_settings
        ADD CONSTRAINT fk_settings_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
        ON DELETE CASCADE
      `;
      console.log('  ✅ tournament_settings → tournaments FK added');
    } catch (e: any) {
      if (e.code === '42710') console.log('  ⚠️  tournament_settings FK already exists');
      else throw e;
    }
    console.log('');

    // ========================================
    // STEP 4: Create Indexes
    // ========================================
    console.log('📊 Step 4/4: Creating performance indexes...');
    
    // Fixtures indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_fixtures_tournament_id ON fixtures(tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_fixtures_season_tournament ON fixtures(season_id, tournament_id)`;
    console.log('  ✅ Fixtures indexes created');
    
    // Player stats indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_realplayerstats_tournament_id ON realplayerstats(tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_realplayerstats_season_tournament ON realplayerstats(season_id, tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_realplayerstats_player_tournament ON realplayerstats(player_id, tournament_id)`;
    console.log('  ✅ Player stats indexes created');
    
    // Team stats indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_tournament_id ON teamstats(tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_season_tournament ON teamstats(season_id, tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_team_tournament ON teamstats(team_id, tournament_id)`;
    console.log('  ✅ Team stats indexes created');
    
    // Matchups indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_matchups_tournament_id ON matchups(tournament_id)`;
    console.log('  ✅ Matchups indexes created\n');

    console.log('=============================================');
    console.log('✨ Constraints and Indexes Complete!');
    console.log('=============================================\n');
    
    console.log('🎉 Database Migration Fully Complete!');
    console.log('');
    console.log('✅ All tables updated');
    console.log('✅ All data migrated');
    console.log('✅ All constraints added');
    console.log('✅ All indexes created\n');
    
    console.log('⚠️  NEXT STEPS:');
    console.log('1. Create tournament management APIs');
    console.log('2. Update existing APIs to support tournament_id');
    console.log('3. Update React hooks');
    console.log('4. Update frontend components\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
addConstraints()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
