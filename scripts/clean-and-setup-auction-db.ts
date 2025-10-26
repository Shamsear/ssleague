/**
 * Clean and Setup Neon Auction Database
 * Drops all existing tables and recreates them fresh
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

async function cleanAndSetup() {
  console.log('🧹 Cleaning Auction Database...\n');
  
  try {
    // Drop all existing tables
    console.log('Dropping existing tables...');
    await sql`DROP TABLE IF EXISTS starred_players CASCADE`;
    await sql`DROP TABLE IF EXISTS bulk_tiebreaker_teams CASCADE`;
    await sql`DROP TABLE IF EXISTS bulk_tiebreaker_bids CASCADE`;
    await sql`DROP TABLE IF EXISTS team_tiebreakers CASCADE`;
    await sql`DROP TABLE IF EXISTS bulk_tiebreakers CASCADE`;
    await sql`DROP TABLE IF EXISTS tiebreakers CASCADE`;
    await sql`DROP TABLE IF EXISTS auction_settings CASCADE`;
    await sql`DROP TABLE IF EXISTS round_bids CASCADE`;
    await sql`DROP TABLE IF EXISTS bids CASCADE`;
    await sql`DROP TABLE IF EXISTS round_players CASCADE`;
    await sql`DROP TABLE IF EXISTS rounds CASCADE`;
    await sql`DROP TABLE IF EXISTS footballplayers CASCADE`;
    await sql`DROP TABLE IF EXISTS round_deadlines CASCADE`;
    await sql`DROP TABLE IF EXISTS tournament_settings CASCADE`;
    console.log('✅ Old tables dropped\n');
    
    console.log('Creating fresh tables...\n');
    
    // Now create all tables fresh
    await sql`
      CREATE TABLE footballplayers (
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
    
    await sql`
      CREATE TABLE rounds (
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
    
    await sql`
      CREATE TABLE round_players (
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
    
    await sql`
      CREATE TABLE bids (
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
    
    await sql`
      CREATE TABLE round_bids (
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
    
    await sql`
      CREATE TABLE auction_settings (
        id SERIAL PRIMARY KEY,
        season_id VARCHAR(255) UNIQUE NOT NULL,
        settings JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    await sql`
      CREATE TABLE tiebreakers (
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
    
    await sql`
      CREATE TABLE bulk_tiebreakers (
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
    
    await sql`
      CREATE TABLE bulk_tiebreaker_bids (
        id SERIAL PRIMARY KEY,
        tiebreaker_id INTEGER NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        bid_amount INTEGER NOT NULL,
        bid_time TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (tiebreaker_id) REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE
      )
    `;
    
    await sql`
      CREATE TABLE team_tiebreakers (
        id SERIAL PRIMARY KEY,
        tiebreaker_id INTEGER NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        bid_amount INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    await sql`
      CREATE TABLE bulk_tiebreaker_teams (
        id SERIAL PRIMARY KEY,
        tiebreaker_id INTEGER NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (tiebreaker_id) REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE
      )
    `;
    
    await sql`
      CREATE TABLE starred_players (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        player_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, player_id)
      )
    `;
    
    console.log('✅ All tables created\n');
    
    // Create indexes
    console.log('Creating indexes...');
    await sql`CREATE INDEX idx_fp_position ON footballplayers(position)`;
    await sql`CREATE INDEX idx_fp_team ON footballplayers(team_id)`;
    await sql`CREATE INDEX idx_fp_season ON footballplayers(season_id)`;
    await sql`CREATE INDEX idx_fp_sold ON footballplayers(is_sold)`;
    await sql`CREATE INDEX idx_rounds_season ON rounds(season_id)`;
    await sql`CREATE INDEX idx_rounds_status ON rounds(status)`;
    await sql`CREATE INDEX idx_bids_round ON bids(round_id)`;
    await sql`CREATE INDEX idx_bids_team ON bids(team_id)`;
    await sql`CREATE INDEX idx_round_bids_round ON round_bids(round_id)`;
    await sql`CREATE INDEX idx_starred_user ON starred_players(user_id)`;
    console.log('✅ Indexes created\n');
    
    console.log('='.repeat(80));
    console.log('✅ Auction Database Setup Complete!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanAndSetup();
