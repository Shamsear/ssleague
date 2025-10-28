/**
 * Script to create awards table in Neon database
 * Run with: node scripts/create-awards-table.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function createAwardsTable() {
  try {
    console.log('🔄 Creating awards table...\n');

    await sql`
      CREATE TABLE IF NOT EXISTS awards (
        id TEXT PRIMARY KEY,
        
        award_type VARCHAR(20) NOT NULL,
        
        tournament_id TEXT NOT NULL,
        season_id TEXT NOT NULL,
        round_number INTEGER,
        week_number INTEGER,
        
        player_id TEXT,
        player_name TEXT,
        team_id TEXT,
        team_name TEXT,
        
        performance_stats JSONB,
        
        selected_by TEXT NOT NULL,
        selected_by_name TEXT,
        selected_at TIMESTAMP DEFAULT NOW(),
        
        notes TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CHECK (
          (award_type IN ('POTD', 'TOD') AND round_number IS NOT NULL) OR
          (award_type IN ('POTW', 'TOW') AND week_number IS NOT NULL) OR
          (award_type IN ('POTS', 'TOTS'))
        ),
        CHECK (
          (award_type IN ('POTD', 'POTW', 'POTS') AND player_id IS NOT NULL) OR
          (award_type IN ('TOD', 'TOW', 'TOTS') AND team_id IS NOT NULL)
        )
      )
    `;
    console.log('✅ Awards table created\n');

    // Create indexes
    console.log('📝 Creating indexes...');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_awards_tournament_season ON awards(tournament_id, season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_awards_type ON awards(award_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_awards_round ON awards(tournament_id, season_id, round_number)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_awards_week ON awards(tournament_id, season_id, week_number)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_awards_player ON awards(player_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_awards_team ON awards(team_id)`;
    
    console.log('✅ Indexes created\n');

    // Create unique constraints
    console.log('📝 Creating unique constraints...');
    
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_potd ON awards(tournament_id, season_id, round_number) WHERE award_type = 'POTD'`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_potw ON awards(tournament_id, season_id, week_number) WHERE award_type = 'POTW'`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tod ON awards(tournament_id, season_id, round_number) WHERE award_type = 'TOD'`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tow ON awards(tournament_id, season_id, week_number) WHERE award_type = 'TOW'`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pots ON awards(tournament_id, season_id) WHERE award_type = 'POTS'`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tots ON awards(tournament_id, season_id) WHERE award_type = 'TOTS'`;
    
    console.log('✅ Unique constraints created\n');

    console.log('✨ Awards system database setup complete!');
    console.log('\n📍 Next steps:');
    console.log('   1. Access admin UI: /dashboard/committee/awards');
    console.log('   2. Select POTD from MOTM winners');
    console.log('   3. Select POTW after 7 rounds complete');
    console.log('   4. Select season awards at end of season');
    
  } catch (error) {
    console.error('❌ Error creating awards table:', error);
    throw error;
  }
}

createAwardsTable()
  .then(() => {
    console.log('\n👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
