/**
 * Setup Neon Auction Database Schema
 * 
 * Creates all tables needed for the auction system
 * 
 * Usage: npx tsx scripts/setup-auction-db.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ NEON_AUCTION_DB_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(connectionString);

async function setupAuctionDb() {
  console.log('🚀 Setting up Auction Database...\n');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Football Players Table (Main auction player pool)
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
    console.log('✅ footballplayers table created\n');

    // 2. Auction Rounds Table
    console.log('📝 Creating rounds table...');
    await sql`
      CREATE TABLE IF NOT EXISTS rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        season_id VARCHAR(255) NOT NULL,
        position VARCHAR(50),
        position_group VARCHAR(50),
        round_number INTEGER,
        round_type VARCHAR(50) DEFAULT 'normal',
        max_bids_per_team INTEGER DEFAULT 5,
        base_price INTEGER DEFAULT 10,
        duration_seconds INTEGER DEFAULT 300,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ rounds table created\n');

    // 3. Round Players Table
    console.log('📝 Creating round_players table...');
    await sql`
      CREATE TABLE IF NOT EXISTS round_players (
        id SERIAL PRIMARY KEY,
        round_id UUID NOT NULL,
        player_id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255),
        position VARCHAR(50),
        position_group VARCHAR(50),
        base_price INTEGER DEFAULT 10,
        status VARCHAR(50) DEFAULT 'pending',
        winning_team_id VARCHAR(255),
        winning_bid INTEGER,
        bid_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ round_players table created\n');

    // 4. Bids Table
    console.log('📝 Creating bids table...');
    await sql`
      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR(255) NOT NULL,
        player_id VARCHAR(255) NOT NULL,
        round_id UUID NOT NULL,
        amount INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        phase VARCHAR(50),
        actual_bid_amount INTEGER,
        encrypted_bid_data TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ bids table created\n');

    // 5. Round Bids Table (for round bid tracking)
    console.log('📝 Creating round_bids table...');
    await sql`
      CREATE TABLE IF NOT EXISTS round_bids (
        id SERIAL PRIMARY KEY,
        round_id UUID NOT NULL,
        player_id VARCHAR(255) NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        bid_amount INTEGER NOT NULL,
        bid_time TIMESTAMP DEFAULT NOW(),
        is_winning BOOLEAN DEFAULT false,
        FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ round_bids table created\n');

    // 6. Auction Settings Table
    console.log('📝 Creating auction_settings table...');
    await sql`
      CREATE TABLE IF NOT EXISTS auction_settings (
        id SERIAL PRIMARY KEY,
        season_id VARCHAR(255) UNIQUE NOT NULL,
        settings JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ auction_settings table created\n');

    // 7. Tiebreakers Table
    console.log('📝 Creating tiebreakers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS tiebreakers (
        id SERIAL PRIMARY KEY,
        round_id UUID,
        player_id VARCHAR(255),
        tied_teams JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        winning_team_id VARCHAR(255),
        winning_bid INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `;
    console.log('✅ tiebreakers table created\n');

    // 8. Bulk Tiebreakers Table
    console.log('📝 Creating bulk_tiebreakers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS bulk_tiebreakers (
        id SERIAL PRIMARY KEY,
        season_id VARCHAR(255),
        player_id VARCHAR(255),
        player_name VARCHAR(255),
        tied_teams JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        winning_team_id VARCHAR(255),
        winning_bid INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `;
    console.log('✅ bulk_tiebreakers table created\n');

    // 9. Bulk Tiebreaker Bids Table
    console.log('📝 Creating bulk_tiebreaker_bids table...');
    await sql`
      CREATE TABLE IF NOT EXISTS bulk_tiebreaker_bids (
        id SERIAL PRIMARY KEY,
        tiebreaker_id INTEGER NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        bid_amount INTEGER NOT NULL,
        bid_time TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (tiebreaker_id) REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ bulk_tiebreaker_bids table created\n');

    // 10. Team Tiebreakers Table
    console.log('📝 Creating team_tiebreakers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS team_tiebreakers (
        id SERIAL PRIMARY KEY,
        tiebreaker_id INTEGER NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        bid_amount INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ team_tiebreakers table created\n');

    // 11. Bulk Tiebreaker Teams Table
    console.log('📝 Creating bulk_tiebreaker_teams table...');
    await sql`
      CREATE TABLE IF NOT EXISTS bulk_tiebreaker_teams (
        id SERIAL PRIMARY KEY,
        tiebreaker_id INTEGER NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (tiebreaker_id) REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ bulk_tiebreaker_teams table created\n');

    // 12. Starred Players Table (user favorites)
    console.log('📝 Creating starred_players table...');
    await sql`
      CREATE TABLE IF NOT EXISTS starred_players (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        player_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, player_id)
      )
    `;
    console.log('✅ starred_players table created\n');

    // Create indexes
    console.log('📝 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_fp_position ON footballplayers(position)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_fp_team ON footballplayers(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_fp_season ON footballplayers(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_fp_sold ON footballplayers(is_sold)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rounds_season ON rounds(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bids_round ON bids(round_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bids_team ON bids(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_round_bids_round ON round_bids(round_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_players(user_id)`;
    console.log('✅ Indexes created\n');

    console.log('='.repeat(80));
    console.log('✅ Auction Database Setup Complete!');
    console.log('='.repeat(80) + '\n');

    // Test query
    console.log('🔍 Testing connection...');
    const result = await sql`SELECT COUNT(*) as count FROM footballplayers`;
    console.log(`✅ Connection successful! Player count: ${result[0].count}\n`);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupAuctionDb();
