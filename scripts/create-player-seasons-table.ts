import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function createPlayerSeasonsTable() {
  console.log('🔧 Creating player_seasons table for Season 16+ multi-season system...');
  
  try {
    // Create player_seasons table for Season 16+ with contracts, star ratings, etc.
    await sql`
      CREATE TABLE IF NOT EXISTS player_seasons (
        -- Composite Primary Key
        id TEXT PRIMARY KEY,  -- Format: {player_id}_{season_id}
        
        -- References
        player_id TEXT NOT NULL,
        season_id TEXT NOT NULL,
        team_id TEXT,
        
        -- Player Info (denormalized for performance)
        player_name TEXT NOT NULL,
        team TEXT,
        
        -- Contract Info (Season 16+)
        contract_id TEXT,
        contract_start_season TEXT,
        contract_end_season TEXT,
        contract_length INTEGER DEFAULT 2,
        is_auto_registered BOOLEAN DEFAULT false,
        
        -- Category & Rating (Season 16+)
        category TEXT,
        star_rating INTEGER DEFAULT 3,
        points INTEGER DEFAULT 100,
        
        -- Season Stats
        matches_played INTEGER DEFAULT 0,
        goals_scored INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        clean_sheets INTEGER DEFAULT 0,
        motm_awards INTEGER DEFAULT 0,
        
        -- Registration Info
        registration_date TIMESTAMP,
        registration_status TEXT DEFAULT 'active',
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        -- Constraints
        UNIQUE(player_id, season_id)
      )
    `;
    console.log('✅ Created player_seasons table');
    
    // Create indexes for common queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_player 
      ON player_seasons(player_id)
    `;
    console.log('✅ Created index on player_id');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_season 
      ON player_seasons(season_id)
    `;
    console.log('✅ Created index on season_id');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_team 
      ON player_seasons(team_id)
    `;
    console.log('✅ Created index on team_id');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_contract 
      ON player_seasons(contract_id)
    `;
    console.log('✅ Created index on contract_id');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_category 
      ON player_seasons(category)
    `;
    console.log('✅ Created index on category');
    
    // Verify table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons'
      ORDER BY ordinal_position
    `;
    
    console.log('\n📊 Table Structure:');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'NO' ? '(NOT NULL)' : '';
      const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
      console.log(`   - ${col.column_name}: ${col.data_type} ${nullable} ${defaultVal}`.trim());
    });
    
    console.log('\n✅ Migration complete!');
    console.log('\n📝 Usage:');
    console.log('   - For Season 16+: Use player_seasons (has contracts, star ratings, points)');
    console.log('   - For Season 1-15: Use realplayerstats (historical data)');
    console.log('   - Permanent data: Always in Firebase realplayers collection');
    console.log('\n📝 Query Pattern:');
    console.log('   SELECT ps.*, rp.name, rp.is_active');
    console.log('   FROM player_seasons ps');
    console.log('   JOIN Firebase.realplayers rp ON ps.player_id = rp.player_id');
    console.log('   WHERE ps.season_id = \'SSPSLS16\'');
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

createPlayerSeasonsTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
