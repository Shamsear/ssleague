/**
 * Fantasy League Revamp - Phase 4: Engagement Tables Migration Runner V2
 * 
 * This version executes each CREATE TABLE statement separately to avoid transaction issues
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runEngagementMigration() {
  console.log('🚀 Starting Fantasy League Engagement Tables Migration V2...\n');

  const sql = neon(process.env.FANTASY_DATABASE_URL);

  try {
    console.log('📊 Using Fantasy Database URL\n');

    // Step 1: Add columns to fantasy_players
    console.log('Step 1: Adding columns to fantasy_players...');
    await sql.unsafe(`
      ALTER TABLE fantasy_players
      ADD COLUMN IF NOT EXISTS form_status VARCHAR(20) DEFAULT 'steady',
      ADD COLUMN IF NOT EXISTS form_streak INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_5_games_avg DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS form_multiplier DECIMAL(3,2) DEFAULT 1.00,
      ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ownership_percentage DECIMAL(5,2) DEFAULT 0;
    `);
    console.log('✅ Columns added to fantasy_players\n');

    // Step 2: Create fixture_difficulty_ratings
    console.log('Step 2: Creating fixture_difficulty_ratings...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fixture_difficulty_ratings (
        id SERIAL PRIMARY KEY,
        rating_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        round_id VARCHAR(100) NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        opponent_id VARCHAR(100) NOT NULL,
        difficulty_score INTEGER NOT NULL CHECK (difficulty_score BETWEEN 1 AND 5),
        opponent_rank INTEGER,
        opponent_form_avg DECIMAL(10,2),
        is_home BOOLEAN DEFAULT TRUE,
        calculated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(league_id, round_id, team_id)
      );
    `);
    console.log('✅ fixture_difficulty_ratings created\n');

    // Step 3: Create fantasy_predictions
    console.log('Step 3: Creating fantasy_predictions...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_predictions (
        id SERIAL PRIMARY KEY,
        prediction_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        round_id VARCHAR(100) NOT NULL,
        predictions JSONB NOT NULL DEFAULT '{}'::jsonb,
        bonus_points DECIMAL(10,2) DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        total_predictions INTEGER DEFAULT 0,
        is_locked BOOLEAN DEFAULT FALSE,
        locked_at TIMESTAMP,
        calculated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(league_id, team_id, round_id)
      );
    `);
    console.log('✅ fantasy_predictions created\n');

    // Step 4: Create fantasy_challenges
    console.log('Step 4: Creating fantasy_challenges...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_challenges (
        id SERIAL PRIMARY KEY,
        challenge_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        round_id VARCHAR(100),
        challenge_name VARCHAR(200) NOT NULL,
        challenge_description TEXT,
        challenge_type VARCHAR(50) NOT NULL,
        requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
        bonus_points INTEGER DEFAULT 0,
        badge_name VARCHAR(100),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ fantasy_challenges created\n');

    // Step 5: Create fantasy_challenge_completions
    console.log('Step 5: Creating fantasy_challenge_completions...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_challenge_completions (
        id SERIAL PRIMARY KEY,
        completion_id VARCHAR(100) UNIQUE NOT NULL,
        challenge_id VARCHAR(100) NOT NULL REFERENCES fantasy_challenges(challenge_id),
        team_id VARCHAR(100) NOT NULL,
        completed_at TIMESTAMP DEFAULT NOW(),
        bonus_points_awarded INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ fantasy_challenge_completions created\n');

    // Step 6: Create fantasy_power_ups
    console.log('Step 6: Creating fantasy_power_ups...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_power_ups (
        id SERIAL PRIMARY KEY,
        power_up_id VARCHAR(100) UNIQUE NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        triple_captain_remaining INTEGER DEFAULT 1,
        bench_boost_remaining INTEGER DEFAULT 2,
        free_hit_remaining INTEGER DEFAULT 1,
        wildcard_remaining INTEGER DEFAULT 2,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(team_id, league_id)
      );
    `);
    console.log('✅ fantasy_power_ups created\n');

    // Step 7: Create fantasy_power_up_usage
    console.log('Step 7: Creating fantasy_power_up_usage...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_power_up_usage (
        id SERIAL PRIMARY KEY,
        usage_id VARCHAR(100) UNIQUE NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        round_id VARCHAR(100) NOT NULL,
        power_up_type VARCHAR(50) NOT NULL,
        used_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT check_power_up_type CHECK (power_up_type IN ('triple_captain', 'bench_boost', 'free_hit', 'wildcard'))
      );
    `);
    console.log('✅ fantasy_power_up_usage created\n');

    // Step 8: Create fantasy_h2h_fixtures
    console.log('Step 8: Creating fantasy_h2h_fixtures...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_h2h_fixtures (
        id SERIAL PRIMARY KEY,
        fixture_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        round_id VARCHAR(100) NOT NULL,
        team_a_id VARCHAR(100) NOT NULL,
        team_b_id VARCHAR(100) NOT NULL,
        team_a_points DECIMAL(10,2) DEFAULT 0,
        team_b_points DECIMAL(10,2) DEFAULT 0,
        winner_id VARCHAR(100),
        is_draw BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT check_different_teams CHECK (team_a_id != team_b_id),
        CONSTRAINT check_h2h_status CHECK (status IN ('scheduled', 'in_progress', 'completed'))
      );
    `);
    console.log('✅ fantasy_h2h_fixtures created\n');

    // Step 9: Create fantasy_h2h_standings
    console.log('Step 9: Creating fantasy_h2h_standings...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_h2h_standings (
        id SERIAL PRIMARY KEY,
        standing_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        matches_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        points INTEGER DEFAULT 0,
        points_for DECIMAL(10,2) DEFAULT 0,
        points_against DECIMAL(10,2) DEFAULT 0,
        points_difference DECIMAL(10,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(league_id, team_id)
      );
    `);
    console.log('✅ fantasy_h2h_standings created\n');

    // Step 10: Create fantasy_chat_messages
    console.log('Step 10: Creating fantasy_chat_messages...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_chat_messages (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(100) UNIQUE NOT NULL,
        league_id VARCHAR(100) NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        user_id VARCHAR(100) NOT NULL,
        message_text TEXT NOT NULL,
        reactions JSONB DEFAULT '{}'::jsonb,
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ fantasy_chat_messages created\n');

    // Step 11: Create fantasy_achievements
    console.log('Step 11: Creating fantasy_achievements...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_achievements (
        id SERIAL PRIMARY KEY,
        achievement_id VARCHAR(100) UNIQUE NOT NULL,
        achievement_name VARCHAR(200) NOT NULL,
        achievement_description TEXT,
        achievement_category VARCHAR(50) NOT NULL,
        requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
        badge_icon VARCHAR(50),
        badge_color VARCHAR(50),
        points_reward INTEGER DEFAULT 0,
        rarity VARCHAR(20) DEFAULT 'common',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT check_rarity CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
      );
    `);
    console.log('✅ fantasy_achievements created\n');

    // Step 12: Create fantasy_team_achievements
    console.log('Step 12: Creating fantasy_team_achievements...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS fantasy_team_achievements (
        id SERIAL PRIMARY KEY,
        team_achievement_id VARCHAR(100) UNIQUE NOT NULL,
        team_id VARCHAR(100) NOT NULL,
        achievement_id VARCHAR(100) NOT NULL REFERENCES fantasy_achievements(achievement_id),
        unlocked_at TIMESTAMP DEFAULT NOW(),
        progress JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(team_id, achievement_id)
      );
    `);
    console.log('✅ fantasy_team_achievements created\n');

    // Step 13: Add columns to fantasy_teams
    console.log('Step 13: Adding columns to fantasy_teams...');
    await sql.unsafe(`
      ALTER TABLE fantasy_teams
      ADD COLUMN IF NOT EXISTS auto_sub_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS bench_priority JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('✅ Columns added to fantasy_teams\n');

    console.log('✅ All tables and columns created successfully!\n');
    console.log('🎉 Phase 4 engagement tables migration complete!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Run migration
runEngagementMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed');
    process.exit(1);
  });
