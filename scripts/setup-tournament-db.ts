/**
 * Setup Neon Tournament Database Schema
 * 
 * Creates all tables needed for the tournament system
 * 
 * Usage: npx tsx scripts/setup-tournament-db.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

if (!connectionString) {
  console.error('❌ NEON_TOURNAMENT_DB_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(connectionString);

async function setupTournamentDb() {
  console.log('⚽ Setting up Tournament Database...\n');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Tournament Settings Table
    console.log('📝 Creating tournament_settings table...');
    await sql`
      CREATE TABLE IF NOT EXISTS tournament_settings (
        id SERIAL PRIMARY KEY,
        season_id VARCHAR(255) UNIQUE NOT NULL,
        total_rounds INTEGER,
        points_per_win INTEGER DEFAULT 3,
        points_per_draw INTEGER DEFAULT 1,
        points_per_loss INTEGER DEFAULT 0,
        settings JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ tournament_settings table created\n');

    // 2. Fixtures Table
    console.log('📝 Creating fixtures table...');
    await sql`
      CREATE TABLE IF NOT EXISTS fixtures (
        id VARCHAR(255) PRIMARY KEY,
        season_id VARCHAR(255) NOT NULL,
        round_number INTEGER,
        leg VARCHAR(50),
        match_day INTEGER,
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        home_team_name VARCHAR(255),
        away_team_name VARCHAR(255),
        home_score INTEGER,
        away_score INTEGER,
        status VARCHAR(50) DEFAULT 'scheduled',
        result VARCHAR(50),
        scheduled_date TIMESTAMP,
        played_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ fixtures table created\n');

    // 3. Matches Table (detailed match results)
    console.log('📝 Creating matches table...');
    await sql`
      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(255) PRIMARY KEY,
        fixture_id VARCHAR(255) NOT NULL,
        season_id VARCHAR(255) NOT NULL,
        round_number INTEGER,
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        home_score INTEGER,
        away_score INTEGER,
        winner_id VARCHAR(255),
        result_type VARCHAR(50),
        match_date TIMESTAMP,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ matches table created\n');

    // 4. Match Days Table
    console.log('📝 Creating match_days table...');
    await sql`
      CREATE TABLE IF NOT EXISTS match_days (
        id SERIAL PRIMARY KEY,
        season_id VARCHAR(255) NOT NULL,
        round_number INTEGER NOT NULL,
        leg VARCHAR(50) DEFAULT 'first',
        scheduled_date DATE,
        home_fixture_deadline_time VARCHAR(10) DEFAULT '23:30',
        away_fixture_deadline_time VARCHAR(10) DEFAULT '23:45',
        result_entry_deadline_day_offset INTEGER DEFAULT 2,
        result_entry_deadline_time VARCHAR(10) DEFAULT '00:30',
        status VARCHAR(50) DEFAULT 'pending',
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(season_id, round_number, leg)
      )
    `;
    console.log('✅ match_days table created\n');

    // 5. Round Deadlines Table
    console.log('📝 Creating round_deadlines table...');
    await sql`
      CREATE TABLE IF NOT EXISTS round_deadlines (
        id SERIAL PRIMARY KEY,
        tournament_id VARCHAR(255),
        season_id VARCHAR(255) NOT NULL,
        round_number INTEGER NOT NULL,
        leg VARCHAR(20) DEFAULT 'first',
        scheduled_date DATE,
        home_fixture_deadline_time VARCHAR(10) DEFAULT '17:00',
        away_fixture_deadline_time VARCHAR(10) DEFAULT '17:00',
        result_entry_deadline_day_offset INTEGER DEFAULT 2,
        result_entry_deadline_time VARCHAR(10) DEFAULT '00:30',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(tournament_id, round_number, leg)
      )
    `;
    console.log('✅ round_deadlines table created\n');

    // 6. Matchups Table
    console.log('📝 Creating matchups table...');
    await sql`
      CREATE TABLE IF NOT EXISTS matchups (
        id SERIAL PRIMARY KEY,
        season_id VARCHAR(255) NOT NULL,
        round_number INTEGER NOT NULL,
        home_team_id VARCHAR(255),
        away_team_id VARCHAR(255),
        home_team_name VARCHAR(255),
        away_team_name VARCHAR(255),
        result VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ matchups table created\n');

    // 7. Fixture Audit Log Table
    console.log('📝 Creating fixture_audit_log table...');
    await sql`
      CREATE TABLE IF NOT EXISTS fixture_audit_log (
        id SERIAL PRIMARY KEY,
        fixture_id VARCHAR(255) NOT NULL,
        changed_by VARCHAR(255),
        change_type VARCHAR(50),
        old_values JSONB,
        new_values JSONB,
        changes JSONB,
        timestamp TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE
      )
    `;
    console.log('✅ fixture_audit_log table created\n');

    // 8. Real Player Stats Table
    console.log('📝 Creating realplayerstats table...');
    await sql`
      CREATE TABLE IF NOT EXISTS realplayerstats (
        id VARCHAR(255) PRIMARY KEY,
        player_id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        season_id VARCHAR(255) NOT NULL,
        team VARCHAR(255),
        team_id VARCHAR(255),
        category VARCHAR(50),
        
        -- Match Statistics
        matches_played INTEGER DEFAULT 0,
        matches_won INTEGER DEFAULT 0,
        matches_lost INTEGER DEFAULT 0,
        matches_drawn INTEGER DEFAULT 0,
        
        -- Performance Statistics
        goals_scored INTEGER DEFAULT 0,
        goals_conceded INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        clean_sheets INTEGER DEFAULT 0,
        own_goals INTEGER DEFAULT 0,
        
        -- Goalkeeper Statistics
        saves INTEGER DEFAULT 0,
        penalties_saved INTEGER DEFAULT 0,
        
        -- Match Results
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        
        -- Awards
        motm_awards INTEGER DEFAULT 0,
        
        -- Points Calculation
        points REAL DEFAULT 0,
        star_rating INTEGER DEFAULT 0,
        
        -- Trophies
        trophies JSONB DEFAULT '[]'::jsonb,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(player_id, season_id)
      )
    `;
    console.log('✅ realplayerstats table created\n');

    // 9. Team Stats Table
    console.log('📝 Creating teamstats table...');
    await sql`
      CREATE TABLE IF NOT EXISTS teamstats (
        id VARCHAR(255) PRIMARY KEY,
        team_id VARCHAR(255) NOT NULL,
        team_name VARCHAR(255) NOT NULL,
        season_id VARCHAR(255) NOT NULL,
        
        -- Match Statistics
        matches_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        
        -- Goal Statistics
        goals_for INTEGER DEFAULT 0,
        goals_against INTEGER DEFAULT 0,
        goal_difference INTEGER DEFAULT 0,
        
        -- Points
        points INTEGER DEFAULT 0,
        
        -- Form and Streaks
        current_form VARCHAR(10),
        win_streak INTEGER DEFAULT 0,
        unbeaten_streak INTEGER DEFAULT 0,
        
        -- Rankings
        position INTEGER,
        
        -- Trophies/Cups
        trophies JSONB DEFAULT '[]'::jsonb,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(team_id, season_id)
      )
    `;
    console.log('✅ teamstats table created\n');

    // 10. Team Players Table (roster tracking)
    console.log('📝 Creating team_players table...');
    await sql`
      CREATE TABLE IF NOT EXISTS team_players (
        id SERIAL PRIMARY KEY,
        team_id VARCHAR(255) NOT NULL,
        player_id VARCHAR(255) NOT NULL,
        season_id VARCHAR(255) NOT NULL,
        acquisition_price INTEGER,
        acquisition_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        joined_date TIMESTAMP DEFAULT NOW(),
        left_date TIMESTAMP,
        UNIQUE(team_id, player_id, season_id)
      )
    `;
    console.log('✅ team_players table created\n');

    // 11. Leaderboards Table (cached rankings)
    console.log('📝 Creating leaderboards table...');
    await sql`
      CREATE TABLE IF NOT EXISTS leaderboards (
        id SERIAL PRIMARY KEY,
        season_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        category VARCHAR(50),
        rankings JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(season_id, type, category)
      )
    `;
    console.log('✅ leaderboards table created\n');

    // Create indexes
    console.log('📝 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_fixtures_season ON fixtures(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_fixtures_round ON fixtures(round_number)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_matches_fixture ON matches(fixture_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_matchdays_season ON match_days(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_matchdays_active ON match_days(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_round_deadlines_season ON round_deadlines(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_round_deadlines_tournament ON round_deadlines(tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_round_deadlines_status ON round_deadlines(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_playerstats_player ON realplayerstats(player_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_playerstats_season ON realplayerstats(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_playerstats_team ON realplayerstats(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_playerstats_points ON realplayerstats(points DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_season ON teamstats(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_points ON teamstats(points DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamplayers_team ON team_players(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamplayers_season ON team_players(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_leaderboards_season ON leaderboards(season_id)`;
    console.log('✅ Indexes created\n');

    console.log('='.repeat(80));
    console.log('✅ Tournament Database Setup Complete!');
    console.log('='.repeat(80) + '\n');

    // Test query
    console.log('🔍 Testing connection...');
    const result = await sql`SELECT COUNT(*) as count FROM fixtures`;
    console.log(`✅ Connection successful! Fixture count: ${result[0].count}\n`);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupTournamentDb();
