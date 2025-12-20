/**
 * Verify Player Stats Against Matchups
 * 
 * This script calculates player statistics from matchups and compares them
 * with the current database values to identify discrepancies.
 * 
 * Usage:
 *   node scripts/recalculate-player-stats.js           (verification only)
 *   node scripts/recalculate-player-stats.js --update  (update database)
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const SEASON_ID = 'SSPSLS16'; // Change this to target different seasons
const UPDATE_MODE = process.argv.includes('--update');

async function recalculatePlayerStats() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('🔍 Player Stats Verification Tool\n');
  console.log('='.repeat(80));
  console.log(`Season: ${SEASON_ID}`);
  console.log(`Mode: ${UPDATE_MODE ? '✍️  UPDATE (will modify database)' : 'READ-ONLY (no database changes)'}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Get all completed fixtures
    console.log('📋 Step 1: Fetching completed fixtures...');
    const fixtures = await sql`
      SELECT 
        f.id as fixture_id,
        f.season_id,
        f.tournament_id,
        f.round_number,
        f.home_team_id,
        f.away_team_id
      FROM fixtures f
      WHERE f.season_id = ${SEASON_ID}
        AND f.status = 'completed'
      ORDER BY f.round_number ASC
    `;

    console.log(`✅ Found ${fixtures.length} completed fixtures\n`);

    if (fixtures.length === 0) {
      console.log('⚠️  No completed fixtures found');
      return;
    }

    // Step 2: Get all matchups for these fixtures
    console.log('📊 Step 2: Fetching matchups...');
    const fixtureIds = fixtures.map(f => f.fixture_id);
    
    const matchups = await sql`
      SELECT 
        m.fixture_id,
        m.home_player_id,
        m.home_player_name,
        m.away_player_id,
        m.away_player_name,
        m.home_goals,
        m.away_goals,
        f.season_id,
        f.tournament_id
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE m.fixture_id = ANY(${fixtureIds})
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      ORDER BY f.round_number ASC
    `;

    console.log(`✅ Found ${matchups.length} completed matchups\n`);

    // Step 3: Aggregate stats by player from matchups
    console.log('⚙️  Step 3: Calculating stats from matchups...\n');
    
    const calculatedStatsMap = new Map();

    for (const matchup of matchups) {
      // Process home player
      processPlayerMatchup({
        playerStatsMap: calculatedStatsMap,
        playerId: matchup.home_player_id,
        playerName: matchup.home_player_name,
        seasonId: matchup.season_id,
        tournamentId: matchup.tournament_id,
        goals: matchup.home_goals || 0,
      });

      // Process away player
      processPlayerMatchup({
        playerStatsMap: calculatedStatsMap,
        playerId: matchup.away_player_id,
        playerName: matchup.away_player_name,
        seasonId: matchup.season_id,
        tournamentId: matchup.tournament_id,
        goals: matchup.away_goals || 0,
      });
    }

    console.log(`📈 Calculated stats for ${calculatedStatsMap.size} unique players\n`);

    // Step 4: Get current database stats
    console.log('💾 Step 4: Fetching current database stats...');
    const dbStats = await sql`
      SELECT 
        player_id,
        player_name,
        season_id,
        matches_played,
        goals_scored
      FROM player_seasons
      WHERE season_id = ${SEASON_ID}
    `;

    console.log(`✅ Found ${dbStats.length} player records in database\n`);

    // Step 5: Compare and identify discrepancies
    console.log('🔍 Step 5: Comparing calculated vs database stats...\n');
    console.log('='.repeat(80));

    const discrepancies = [];
    const dbStatsMap = new Map();
    
    // Build database stats map (player_seasons doesn't have tournament_id, so we group by player+season)
    dbStats.forEach(stat => {
      const key = `${stat.player_id}_${stat.season_id}`;
      if (!dbStatsMap.has(key)) {
        dbStatsMap.set(key, {
          ...stat,
          goals_scored: stat.goals_scored || 0,
          matches_played: stat.matches_played || 0
        });
      }
    });

    // Aggregate calculated stats by player+season (since player_seasons doesn't track by tournament)
    const calculatedByPlayerSeason = new Map();
    for (const [key, calculated] of calculatedStatsMap) {
      const playerSeasonKey = `${calculated.player_id}_${calculated.season_id}`;
      if (!calculatedByPlayerSeason.has(playerSeasonKey)) {
        calculatedByPlayerSeason.set(playerSeasonKey, {
          player_id: calculated.player_id,
          player_name: calculated.player_name,
          season_id: calculated.season_id,
          matches_played: 0,
          goals: 0,
        });
      }
      const aggregated = calculatedByPlayerSeason.get(playerSeasonKey);
      aggregated.matches_played += calculated.matches_played;
      aggregated.goals += calculated.goals;
    }

    // Compare each calculated stat with database
    for (const [key, calculated] of calculatedByPlayerSeason) {
      const dbStat = dbStatsMap.get(key);

      if (!dbStat) {
        discrepancies.push({
          type: 'MISSING',
          player_name: calculated.player_name,
          player_id: calculated.player_id,
          calculated,
          database: null,
        });
      } else {
        const matchesMismatch = calculated.matches_played !== dbStat.matches_played;
        const goalsMismatch = calculated.goals !== dbStat.goals_scored;

        if (matchesMismatch || goalsMismatch) {
          discrepancies.push({
            type: 'MISMATCH',
            player_name: calculated.player_name,
            player_id: calculated.player_id,
            calculated,
            database: dbStat,
            differences: {
              matches: matchesMismatch ? {
                calculated: calculated.matches_played,
                database: dbStat.matches_played,
                diff: calculated.matches_played - dbStat.matches_played
              } : null,
              goals: goalsMismatch ? {
                calculated: calculated.goals,
                database: dbStat.goals_scored,
                diff: calculated.goals - dbStat.goals_scored
              } : null,
            }
          });
        }
      }
    }

    // Check for extra records in database
    for (const [key, dbStat] of dbStatsMap) {
      if (!calculatedByPlayerSeason.has(key)) {
        discrepancies.push({
          type: 'EXTRA',
          player_name: dbStat.player_name,
          player_id: dbStat.player_id,
          calculated: null,
          database: dbStat,
        });
      }
    }

    // Display results
    if (discrepancies.length === 0) {
      console.log('✅ ALL STATS MATCH! No discrepancies found.\n');
    } else {
      console.log(`⚠️  Found ${discrepancies.length} discrepancies:\n`);

      // Group by type
      const missing = discrepancies.filter(d => d.type === 'MISSING');
      const mismatches = discrepancies.filter(d => d.type === 'MISMATCH');
      const extra = discrepancies.filter(d => d.type === 'EXTRA');

      if (missing.length > 0) {
        console.log(`\n❌ MISSING IN DATABASE (${missing.length}):`);
        console.log('   These players have matchup data but no database record:\n');
        missing.slice(0, 10).forEach(d => {
          console.log(`   • ${d.player_name} (${d.player_id})`);
          console.log(`     Calculated: ${d.calculated.matches_played} matches, ${d.calculated.goals} goals`);
          console.log('');
        });
        if (missing.length > 10) {
          console.log(`   ... and ${missing.length - 10} more\n`);
        }
      }

      if (mismatches.length > 0) {
        console.log(`\n⚠️  MISMATCHES (${mismatches.length}):`);
        console.log('   Stats don\'t match between calculated and database:\n');
        mismatches.slice(0, 10).forEach(d => {
          console.log(`   • ${d.player_name} (${d.player_id})`);
          if (d.differences.matches) {
            console.log(`     Matches: DB=${d.differences.matches.database}, Calculated=${d.differences.matches.calculated} (diff: ${d.differences.matches.diff > 0 ? '+' : ''}${d.differences.matches.diff})`);
          }
          if (d.differences.goals) {
            console.log(`     Goals: DB=${d.differences.goals.database}, Calculated=${d.differences.goals.calculated} (diff: ${d.differences.goals.diff > 0 ? '+' : ''}${d.differences.goals.diff})`);
          }
          console.log('');
        });
        if (mismatches.length > 10) {
          console.log(`   ... and ${mismatches.length - 10} more\n`);
        }
      }

      if (extra.length > 0) {
        console.log(`\n🔍 EXTRA IN DATABASE (${extra.length}):`);
        console.log('   These records exist in database but have no matchup data:\n');
        extra.slice(0, 10).forEach(d => {
          console.log(`   • ${d.player_name} (${d.player_id})`);
          console.log(`     Database: ${d.database.matches_played} matches, ${d.database.goals} goals`);
          console.log('');
        });
        if (extra.length > 10) {
          console.log(`   ... and ${extra.length - 10} more\n`);
        }
      }
    }

    console.log('='.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   Calculated from matchups: ${calculatedByPlayerSeason.size} players`);
    console.log(`   In database: ${dbStats.length} records`);
    console.log(`   Missing in DB: ${discrepancies.filter(d => d.type === 'MISSING').length}`);
    console.log(`   Mismatches: ${discrepancies.filter(d => d.type === 'MISMATCH').length}`);
    console.log(`   Extra in DB: ${discrepancies.filter(d => d.type === 'EXTRA').length}`);
    console.log(`   Total Goals (calculated): ${Array.from(calculatedByPlayerSeason.values()).reduce((sum, p) => sum + p.goals, 0)}`);
    console.log(`   Total Goals (database): ${dbStats.reduce((sum, p) => sum + (p.goals_scored || 0), 0)}`);

    // Step 6: Update database if in update mode
    if (UPDATE_MODE && discrepancies.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('✍️  Step 6: Updating database...\n');

      let updated = 0;
      let errors = 0;

      const mismatches = discrepancies.filter(d => d.type === 'MISMATCH');
      
      for (const discrepancy of mismatches) {
        try {
          await sql`
            UPDATE player_seasons
            SET
              matches_played = ${discrepancy.calculated.matches_played},
              goals_scored = ${discrepancy.calculated.goals},
              updated_at = NOW()
            WHERE player_id = ${discrepancy.player_id}
              AND season_id = ${SEASON_ID}
          `;
          updated++;
          
          if (updated % 5 === 0) {
            process.stdout.write(`\r   Progress: ${updated}/${mismatches.length} players updated...`);
          }
        } catch (error) {
          console.error(`\n❌ Error updating ${discrepancy.player_name}:`, error.message);
          errors++;
        }
      }

      console.log(`\n\n✅ Database update complete!\n`);
      console.log('📊 Update Summary:');
      console.log(`   Updated: ${updated} players`);
      console.log(`   Errors: ${errors}`);
      console.log(`   Skipped (missing/extra): ${discrepancies.length - mismatches.length}`);
    } else if (UPDATE_MODE && discrepancies.length === 0) {
      console.log('\n✅ No updates needed - all stats match!');
    } else if (!UPDATE_MODE && discrepancies.length > 0) {
      console.log('\n💡 To update the database with these corrections, run:');
      console.log('   node scripts/recalculate-player-stats.js --update');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Verification complete');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

function processPlayerMatchup({ playerStatsMap, playerId, playerName, seasonId, tournamentId, goals }) {
  const key = `${playerId}_${seasonId}_${tournamentId}`;
  
  if (!playerStatsMap.has(key)) {
    playerStatsMap.set(key, {
      player_id: playerId,
      player_name: playerName,
      season_id: seasonId,
      tournament_id: tournamentId,
      matches_played: 0,
      goals: 0,
    });
  }

  const stats = playerStatsMap.get(key);
  stats.matches_played += 1;
  stats.goals += goals;
}

// Run the script
if (require.main === module) {
  recalculatePlayerStats()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { recalculatePlayerStats };
