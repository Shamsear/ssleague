/**
 * Preview Script: Compare Matchup Stats vs Player Season Stats
 * 
 * This script:
 * 1. Aggregates all stats from matchups for each player
 * 2. Compares with player_seasons stats
 * 3. Reports discrepancies
 * 
 * Stats checked:
 * - matches_played
 * - wins
 * - draws
 * - losses
 * - goals_scored
 * - goals_conceded
 * - clean_sheets
 * - Any other stats in player_seasons
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function previewPlayerStatsComparison() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  const SEASON_ID = 'SSPSLS16'; // Only check this season

  console.log(`🔍 Starting Player Stats Comparison Preview for Season: ${SEASON_ID}\n`);

  try {
    // Get all player_seasons with their current stats for SSPSLS16
    const playerSeasons = await sql`
      SELECT 
        player_id,
        season_id,
        team_id,
        player_name,
        matches_played,
        wins,
        draws,
        losses,
        goals_scored,
        goals_conceded,
        clean_sheets,
        motm_awards,
        assists,
        points,
        star_rating,
        category
      FROM player_seasons
      WHERE status = 'active'
        AND season_id = ${SEASON_ID}
      ORDER BY team_id, player_name
    `;

    console.log(`📊 Found ${playerSeasons.length} active player seasons\n`);

    const discrepancies = [];
    const summary = {
      totalPlayers: playerSeasons.length,
      playersWithDiscrepancies: 0,
      playersMatching: 0,
      playersWithNoMatchups: 0,
      totalDiscrepancyCount: 0
    };

    // Process each player
    for (const player of playerSeasons) {
      // Aggregate stats from matchups
      const matchupStats = await sql`
        WITH home_matches AS (
          SELECT 
            m.home_player_id as player_id,
            m.season_id,
            COUNT(*) as matches,
            SUM(CASE 
              WHEN m.home_goals > m.away_goals THEN 1 
              ELSE 0 
            END) as wins,
            SUM(CASE 
              WHEN m.home_goals = m.away_goals THEN 1 
              ELSE 0 
            END) as draws,
            SUM(CASE 
              WHEN m.home_goals < m.away_goals THEN 1 
              ELSE 0 
            END) as losses,
            SUM(COALESCE(m.home_goals, 0)) as goals_scored,
            SUM(COALESCE(m.away_goals, 0)) as goals_conceded,
            SUM(CASE 
              WHEN COALESCE(m.away_goals, 0) = 0 THEN 1 
              ELSE 0 
            END) as clean_sheets
          FROM matchups m
          WHERE m.home_player_id = ${player.player_id}
            AND m.season_id = ${player.season_id}
            AND m.home_goals IS NOT NULL
            AND m.away_goals IS NOT NULL
            AND COALESCE(m.is_null, false) = false
          GROUP BY m.home_player_id, m.season_id
        ),
        away_matches AS (
          SELECT 
            m.away_player_id as player_id,
            m.season_id,
            COUNT(*) as matches,
            SUM(CASE 
              WHEN m.away_goals > m.home_goals THEN 1 
              ELSE 0 
            END) as wins,
            SUM(CASE 
              WHEN m.away_goals = m.home_goals THEN 1 
              ELSE 0 
            END) as draws,
            SUM(CASE 
              WHEN m.away_goals < m.home_goals THEN 1 
              ELSE 0 
            END) as losses,
            SUM(COALESCE(m.away_goals, 0)) as goals_scored,
            SUM(COALESCE(m.home_goals, 0)) as goals_conceded,
            SUM(CASE 
              WHEN COALESCE(m.home_goals, 0) = 0 THEN 1 
              ELSE 0 
            END) as clean_sheets
          FROM matchups m
          WHERE m.away_player_id = ${player.player_id}
            AND m.season_id = ${player.season_id}
            AND m.home_goals IS NOT NULL
            AND m.away_goals IS NOT NULL
            AND COALESCE(m.is_null, false) = false
          GROUP BY m.away_player_id, m.season_id
        ),
        motm_count AS (
          SELECT 
            f.motm_player_id as player_id,
            f.season_id,
            COUNT(*) as motm
          FROM fixtures f
          WHERE f.motm_player_id = ${player.player_id}
            AND f.season_id = ${player.season_id}
          GROUP BY f.motm_player_id, f.season_id
        )
        SELECT 
          COALESCE(h.matches, 0) + COALESCE(a.matches, 0) as total_matches,
          COALESCE(h.wins, 0) + COALESCE(a.wins, 0) as total_wins,
          COALESCE(h.draws, 0) + COALESCE(a.draws, 0) as total_draws,
          COALESCE(h.losses, 0) + COALESCE(a.losses, 0) as total_losses,
          COALESCE(h.goals_scored, 0) + COALESCE(a.goals_scored, 0) as total_goals_scored,
          COALESCE(h.goals_conceded, 0) + COALESCE(a.goals_conceded, 0) as total_goals_conceded,
          COALESCE(h.clean_sheets, 0) + COALESCE(a.clean_sheets, 0) as total_clean_sheets,
          COALESCE(m.motm, 0) as total_motm
        FROM (SELECT 1) dummy
        LEFT JOIN home_matches h ON true
        LEFT JOIN away_matches a ON true
        LEFT JOIN motm_count m ON true
      `;

      const stats = matchupStats[0];
      const playerDiscrepancies = [];

      // Compare each stat
      const comparisons = [
        { name: 'matches_played', db: player.matches_played || 0, calculated: parseInt(stats.total_matches) || 0 },
        { name: 'wins', db: player.wins || 0, calculated: parseInt(stats.total_wins) || 0 },
        { name: 'draws', db: player.draws || 0, calculated: parseInt(stats.total_draws) || 0 },
        { name: 'losses', db: player.losses || 0, calculated: parseInt(stats.total_losses) || 0 },
        { name: 'goals_scored', db: player.goals_scored || 0, calculated: parseInt(stats.total_goals_scored) || 0 },
        { name: 'goals_conceded', db: player.goals_conceded || 0, calculated: parseInt(stats.total_goals_conceded) || 0 },
        { name: 'clean_sheets', db: player.clean_sheets || 0, calculated: parseInt(stats.total_clean_sheets) || 0 },
        { name: 'motm_awards', db: player.motm_awards || 0, calculated: parseInt(stats.total_motm) || 0 }
      ];

      let hasDiscrepancy = false;

      for (const comp of comparisons) {
        if (comp.db !== comp.calculated) {
          hasDiscrepancy = true;
          playerDiscrepancies.push({
            stat: comp.name,
            inDatabase: comp.db,
            fromMatchups: comp.calculated,
            difference: comp.calculated - comp.db
          });
        }
      }

      if (hasDiscrepancy) {
        summary.playersWithDiscrepancies++;
        summary.totalDiscrepancyCount += playerDiscrepancies.length;

        discrepancies.push({
          player_id: player.player_id,
          player_name: player.player_name,
          team_id: player.team_id,
          season_id: player.season_id,
          discrepancies: playerDiscrepancies
        });
      } else if (parseInt(stats.total_matches) === 0) {
        summary.playersWithNoMatchups++;
      } else {
        summary.playersMatching++;
      }
    }

    // Print Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    SUMMARY REPORT                         ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Total Players Analyzed:        ${summary.totalPlayers}`);
    console.log(`✅ Players Matching:            ${summary.playersMatching}`);
    console.log(`⚠️  Players with Discrepancies: ${summary.playersWithDiscrepancies}`);
    console.log(`📭 Players with No Matchups:    ${summary.playersWithNoMatchups}`);
    console.log(`🔢 Total Discrepancy Count:     ${summary.totalDiscrepancyCount}\n`);

    // Print Detailed Discrepancies
    if (discrepancies.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('                 DETAILED DISCREPANCIES                    ');
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const disc of discrepancies) {
        console.log(`\n🔴 ${disc.player_name} (${disc.player_id})`);
        console.log(`   Team: ${disc.team_id} | Season: ${disc.season_id}`);
        console.log('   ─────────────────────────────────────────────────────');

        for (const d of disc.discrepancies) {
          const arrow = d.difference > 0 ? '↑' : '↓';
          const color = d.difference > 0 ? '+' : '';
          console.log(`   ${d.stat.padEnd(20)} | DB: ${String(d.inDatabase).padStart(4)} | Matchups: ${String(d.fromMatchups).padStart(4)} | ${arrow} ${color}${d.difference}`);
        }
      }

      console.log('\n═══════════════════════════════════════════════════════════\n');

      // Group by stat type
      console.log('📊 DISCREPANCIES BY STAT TYPE:\n');
      const statGroups = {};

      for (const disc of discrepancies) {
        for (const d of disc.discrepancies) {
          if (!statGroups[d.stat]) {
            statGroups[d.stat] = {
              count: 0,
              totalDifference: 0,
              players: []
            };
          }
          statGroups[d.stat].count++;
          statGroups[d.stat].totalDifference += Math.abs(d.difference);
          statGroups[d.stat].players.push(disc.player_name);
        }
      }

      for (const [stat, data] of Object.entries(statGroups)) {
        console.log(`   ${stat.padEnd(20)} | ${data.count} players affected | Total diff: ${data.totalDifference}`);
      }

      console.log('\n═══════════════════════════════════════════════════════════\n');

      // Export to JSON for further analysis
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `player-stats-discrepancies-${timestamp}.json`;

      fs.writeFileSync(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary,
        discrepancies
      }, null, 2));

      console.log(`📄 Detailed report saved to: ${filename}\n`);
    } else {
      console.log('✅ All player stats match perfectly! No discrepancies found.\n');
    }

    // Recommendations
    if (summary.playersWithDiscrepancies > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('                    RECOMMENDATIONS                        ');
      console.log('═══════════════════════════════════════════════════════════\n');

      console.log('To fix discrepancies, you can:');
      console.log('1. Run the recalculation script to update player_seasons from matchups');
      console.log('2. Manually review and fix specific player stats');
      console.log('3. Check if there are missing or duplicate matchup entries\n');

      console.log('Suggested command:');
      console.log('   node scripts/recalculate-player-stats.js\n');
    }

  } catch (error) {
    console.error('❌ Error during comparison:', error);
    throw error;
  }
}

// Run the preview
previewPlayerStatsComparison()
  .then(() => {
    console.log('✅ Preview completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Preview failed:', error);
    process.exit(1);
  });
