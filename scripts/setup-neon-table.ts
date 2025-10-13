/**
 * Setup Neon Database Table
 * 
 * Creates the footballplayers table with all fields
 * 
 * Usage: npx tsx scripts/setup-neon-table.ts
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ NEON_DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(connectionString);

async function setupTable() {
  console.log('🚀 Setting up Neon database table...\n');

  try {
    // Step 1: Create table
    console.log('📝 Creating footballplayers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS footballplayers (
        id VARCHAR(255) PRIMARY KEY,
        player_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        position VARCHAR(50),
        position_group VARCHAR(50),
        team_id VARCHAR(255),
        team_name VARCHAR(255),
        season_id VARCHAR(255),
        round_id VARCHAR(255),
        is_auction_eligible BOOLEAN DEFAULT true,
        is_sold BOOLEAN DEFAULT false,
        acquisition_value INTEGER,
        nationality VARCHAR(100),
        age INTEGER,
        club VARCHAR(255),
        playing_style VARCHAR(50),
        overall_rating INTEGER,
        offensive_awareness INTEGER,
        ball_control INTEGER,
        dribbling INTEGER,
        tight_possession INTEGER,
        low_pass INTEGER,
        lofted_pass INTEGER,
        finishing INTEGER,
        heading INTEGER,
        set_piece_taking INTEGER,
        curl INTEGER,
        speed INTEGER,
        acceleration INTEGER,
        kicking_power INTEGER,
        jumping INTEGER,
        physical_contact INTEGER,
        balance INTEGER,
        stamina INTEGER,
        defensive_awareness INTEGER,
        tackling INTEGER,
        aggression INTEGER,
        defensive_engagement INTEGER,
        gk_awareness INTEGER,
        gk_catching INTEGER,
        gk_parrying INTEGER,
        gk_reflexes INTEGER,
        gk_reach INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Table created\n');

    // Step 2: Create indexes
    console.log('📝 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_position ON footballplayers(position)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_team_id ON footballplayers(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_season_id ON footballplayers(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_round_id ON footballplayers(round_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_auction_eligible ON footballplayers(is_auction_eligible)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_is_sold ON footballplayers(is_sold)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_overall_rating ON footballplayers(overall_rating)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_name ON footballplayers(name)`;
    console.log('✅ Indexes created\n');

    // Step 3: Test query
    console.log('🔍 Testing connection...');
    const result = await sql`SELECT COUNT(*) as count FROM footballplayers`;
    console.log(`✅ Connection successful! Current player count: ${result[0].count}\n`);

    console.log('🎉 Database setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Export players from Firestore manually or via Firebase console');
    console.log('2. Use the API routes to import players');
    console.log('3. Or run the full migration script after fixing Firebase config');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupTable();
