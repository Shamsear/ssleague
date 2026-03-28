const { neon } = require('@neondatabase/serverless');

async function runMigration() {
  const fantasyDbUrl = process.env.FANTASY_DATABASE_URL;
  
  if (!fantasyDbUrl) {
    console.error('❌ FANTASY_DATABASE_URL not found in environment');
    process.exit(1);
  }

  const sql = neon(fantasyDbUrl);

  console.log('🚀 Creating fantasy_transfer_windows table...\n');

  try {
    // Create the transfer windows table
    await sql`
      CREATE TABLE IF NOT EXISTS fantasy_transfer_windows (
        id SERIAL PRIMARY KEY,
        window_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        
        -- Window details
        window_name VARCHAR(200),
        
        -- Timing
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        opens_at TIMESTAMP,
        closes_at TIMESTAMP,
        
        -- Status
        status VARCHAR(20) DEFAULT 'scheduled',
        is_active BOOLEAN DEFAULT false,
        
        -- Window type (optional for future use)
        window_type VARCHAR(20),
        
        -- Configuration
        config JSONB DEFAULT '{}'::jsonb,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        -- Constraints
        CONSTRAINT check_valid_window_status CHECK (status IN ('scheduled', 'active', 'closed')),
        CONSTRAINT check_end_after_start CHECK (end_time > start_time),
        CONSTRAINT check_closes_after_opens CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
      )
    `;
    
    console.log('✅ fantasy_transfer_windows table created\n');

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_league 
      ON fantasy_transfer_windows(league_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_active 
      ON fantasy_transfer_windows(league_id, is_active) 
      WHERE is_active = true
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_transfer_windows_timing 
      ON fantasy_transfer_windows(league_id, opens_at, closes_at)
    `;
    
    console.log('✅ Indexes created\n');

    // Now add the simplified columns and migrate data
    console.log('📝 Migrating existing data...\n');
    
    await sql`
      UPDATE fantasy_transfer_windows
      SET 
        window_name = COALESCE(window_name, 'Transfer Window ' || id),
        opens_at = COALESCE(opens_at, start_time),
        closes_at = COALESCE(closes_at, end_time),
        is_active = COALESCE(is_active, (status = 'active'))
      WHERE window_name IS NULL OR opens_at IS NULL OR closes_at IS NULL
    `;
    
    console.log('✅ Data migration complete\n');

    // Verify the table
    console.log('🔍 Verifying table structure...\n');
    
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fantasy_transfer_windows'
      ORDER BY ordinal_position
    `;
    
    console.log('Table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✅ Transfer windows table ready!');
    console.log('\n📋 Summary:');
    console.log('  - fantasy_transfer_windows table created');
    console.log('  - All indexes created');
    console.log('  - Ready for transfer window management');
    console.log('\n🎯 Next: The transfer window management page is now fully functional!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
