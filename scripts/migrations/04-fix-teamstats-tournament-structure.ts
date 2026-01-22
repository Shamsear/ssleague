/**
 * PHASE 4: Fix TeamStats Tournament Structure
 * 
 * This script fixes the teamstats table structure to properly support
 * teams participating in multiple tournaments within the same season.
 * 
 * Changes:
 * 1. Changes id from teamid_seasonid to teamid_tournamentid
 * 2. Ensures primary key is (team_id, tournament_id)
 * 3. Migrates existing data to new structure
 * 
 * Run this AFTER 03-add-constraints.ts
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
config({ path: '.env.local' });

async function fixTeamStatsStructure() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

  console.log('🚀 Starting TeamStats Tournament Structure Fix');
  console.log('=============================================\n');

  try {
    // ========================================
    // STEP 1: Analyze Current Data
    // ========================================
    console.log('📊 Step 1/5: Analyzing current data...');

    const currentStats = await sql`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT team_id) as unique_teams,
        COUNT(DISTINCT season_id) as unique_seasons,
        COUNT(DISTINCT tournament_id) as unique_tournaments,
        COUNT(*) FILTER (WHERE tournament_id IS NULL) as null_tournament_count
      FROM teamstats
    `;

    console.log(`  📈 Current state:`);
    console.log(`     - Total rows: ${currentStats[0].total_rows}`);
    console.log(`     - Unique teams: ${currentStats[0].unique_teams}`);
    console.log(`     - Unique seasons: ${currentStats[0].unique_seasons}`);
    console.log(`     - Unique tournaments: ${currentStats[0].unique_tournaments}`);
    console.log(`     - Rows without tournament: ${currentStats[0].null_tournament_count}\n`);

    // ========================================
    // STEP 2: Handle Rows Without Tournament ID
    // ========================================
    console.log('📊 Step 2/5: Handling rows without tournament_id...');

    // For rows without tournament_id, assign them to the default LEAGUE tournament
    const rowsWithoutTournament = await sql`
      SELECT team_id, season_id, id
      FROM teamstats
      WHERE tournament_id IS NULL
    `;

    if (rowsWithoutTournament.length > 0) {
      console.log(`  ⚠️  Found ${rowsWithoutTournament.length} rows without tournament_id`);

      for (const row of rowsWithoutTournament) {
        const defaultTournamentId = `${row.season_id}-LEAGUE`;

        // Check if this tournament exists
        const tournamentExists = await sql`
          SELECT id FROM tournaments WHERE id = ${defaultTournamentId} LIMIT 1
        `;

        if (tournamentExists.length === 0) {
          console.log(`  ⚠️  Creating default tournament: ${defaultTournamentId}`);

          // Create the default tournament
          await sql`
            INSERT INTO tournaments (
              id, season_id, tournament_name, tournament_code, tournament_type, 
              status, is_primary, display_order, created_at, updated_at
            )
            VALUES (
              ${defaultTournamentId},
              ${row.season_id},
              'League',
              ${defaultTournamentId},
              'league',
              'completed',
              true,
              0,
              NOW(),
              NOW()
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }

        // Update the row with the default tournament
        await sql`
          UPDATE teamstats
          SET tournament_id = ${defaultTournamentId}
          WHERE id = ${row.id}
        `;
      }

      console.log(`  ✅ Assigned default tournaments to ${rowsWithoutTournament.length} rows\n`);
    } else {
      console.log(`  ✅ All rows have tournament_id\n`);
    }

    // ========================================
    // STEP 3: Create New Table with Correct Structure
    // ========================================
    console.log('📊 Step 3/5: Creating new table structure...');

    await sql`
      CREATE TABLE IF NOT EXISTS teamstats_new (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        tournament_id TEXT NOT NULL,
        season_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        points INTEGER DEFAULT 0,
        matches_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        goals_for INTEGER DEFAULT 0,
        goals_against INTEGER DEFAULT 0,
        goal_difference INTEGER DEFAULT 0,
        current_form TEXT,
        win_streak INTEGER DEFAULT 0,
        unbeaten_streak INTEGER DEFAULT 0,
        trophies JSONB DEFAULT '[]'::jsonb,
        processed_fixtures JSONB DEFAULT '[]'::jsonb,
        points_deducted INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(team_id, tournament_id)
      )
    `;
    console.log('  ✅ Created teamstats_new table\n');

    // ========================================
    // STEP 4: Migrate Data with New ID Format
    // ========================================
    console.log('📊 Step 4/5: Migrating data to new structure...');

    // Get all current teamstats
    const allStats = await sql`
      SELECT * FROM teamstats
      WHERE tournament_id IS NOT NULL
    `;

    console.log(`  📦 Migrating ${allStats.length} rows...`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const stat of allStats) {
      const newId = `${stat.team_id}_${stat.tournament_id}`;

      try {
        await sql`
          INSERT INTO teamstats_new (
            id, team_id, tournament_id, season_id, team_name,
            position, points, matches_played,
            wins, draws, losses,
            goals_for, goals_against, goal_difference,
            current_form, win_streak, unbeaten_streak,
            trophies, processed_fixtures, points_deducted,
            created_at, updated_at
          )
          VALUES (
            ${newId},
            ${stat.team_id},
            ${stat.tournament_id},
            ${stat.season_id},
            ${stat.team_name},
            ${stat.position || 0},
            ${stat.points || 0},
            ${stat.matches_played || 0},
            ${stat.wins || 0},
            ${stat.draws || 0},
            ${stat.losses || 0},
            ${stat.goals_for || 0},
            ${stat.goals_against || 0},
            ${stat.goal_difference || 0},
            ${stat.current_form || null},
            ${stat.win_streak || 0},
            ${stat.unbeaten_streak || 0},
            ${JSON.stringify(stat.trophies || [])},
            ${JSON.stringify(stat.processed_fixtures || [])},
            ${stat.points_deducted || 0},
            ${stat.created_at || 'NOW()'},
            ${stat.updated_at || 'NOW()'}
          )
          ON CONFLICT (team_id, tournament_id) DO UPDATE SET
            season_id = EXCLUDED.season_id,
            team_name = EXCLUDED.team_name,
            position = EXCLUDED.position,
            points = EXCLUDED.points,
            matches_played = EXCLUDED.matches_played,
            wins = EXCLUDED.wins,
            draws = EXCLUDED.draws,
            losses = EXCLUDED.losses,
            goals_for = EXCLUDED.goals_for,
            goals_against = EXCLUDED.goals_against,
            goal_difference = EXCLUDED.goal_difference,
            current_form = EXCLUDED.current_form,
            win_streak = EXCLUDED.win_streak,
            unbeaten_streak = EXCLUDED.unbeaten_streak,
            trophies = EXCLUDED.trophies,
            processed_fixtures = EXCLUDED.processed_fixtures,
            points_deducted = EXCLUDED.points_deducted,
            updated_at = NOW()
        `;
        migratedCount++;
      } catch (error: any) {
        console.log(`  ⚠️  Skipped duplicate: ${stat.team_id} in ${stat.tournament_id}`);
        skippedCount++;
      }
    }

    console.log(`  ✅ Migrated ${migratedCount} rows`);
    if (skippedCount > 0) {
      console.log(`  ⚠️  Skipped ${skippedCount} duplicate rows\n`);
    } else {
      console.log('');
    }

    // ========================================
    // STEP 5: Swap Tables
    // ========================================
    console.log('📊 Step 5/5: Swapping tables...');

    // Drop foreign key constraints first
    await sql`ALTER TABLE teamstats DROP CONSTRAINT IF EXISTS fk_teamstats_tournament`;
    console.log('  ✅ Dropped foreign key constraint');

    // Rename old table
    await sql`ALTER TABLE teamstats RENAME TO teamstats_old`;
    console.log('  ✅ Renamed old table to teamstats_old');

    // Rename new table
    await sql`ALTER TABLE teamstats_new RENAME TO teamstats`;
    console.log('  ✅ Renamed new table to teamstats');

    // Re-add foreign key constraint
    await sql`
      ALTER TABLE teamstats
      ADD CONSTRAINT fk_teamstats_tournament
      FOREIGN KEY(tournament_id) REFERENCES tournaments(id)
      ON DELETE CASCADE
    `;
    console.log('  ✅ Re-added foreign key constraint');

    // Add indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_tournament_id ON teamstats(tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_season_id ON teamstats(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_team_id ON teamstats(team_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_season_tournament ON teamstats(season_id, tournament_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teamstats_team_tournament ON teamstats(team_id, tournament_id)`;
    console.log('  ✅ Created indexes\n');

    console.log('=============================================');
    console.log('✨ TeamStats Structure Fix Complete!');
    console.log('=============================================\n');

    console.log('📋 Summary:');
    console.log(`   - ID format changed: teamid_seasonid → teamid_tournamentid`);
    console.log(`   - Primary key: id (unique)`);
    console.log(`   - Unique constraint: (team_id, tournament_id)`);
    console.log(`   - Old table preserved as: teamstats_old\n`);

    console.log('⚠️  NEXT STEPS:');
    console.log('1. Test the new structure thoroughly');
    console.log('2. Update application code to use new ID format');
    console.log('3. Once confirmed working, drop teamstats_old:');
    console.log('   DROP TABLE teamstats_old;\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
fixTeamStatsStructure()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
