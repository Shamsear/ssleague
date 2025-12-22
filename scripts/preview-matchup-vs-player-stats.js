/**
 * Preview Script: Compare Matchup Stats vs Player Season Stats
 * 
 * This script:
 * 1. Aggregates all goals from matchups for each player
 * 2. Compares with player_seasons stats
 * 3. Reports discrepancies
 * 
 * Usage: node scripts/preview-matchup-vs-player-stats.js [season_id]
 */

const { neon } = require('@neondatabase/serverless');

// Get season_id from command line or use default
const seasonId = process.argv[2] || 'SSPSLS16';

async function main() {
  console.log('🔍 Matchup Stats vs Player Stats Preview');
  console.log('=========================================\n');
  console.log(`Season: ${seasonId}\n`);

  // Initialize Neon connection
  const sql = neon(process.env.TOURNAMENT_DATABASE_URL);

  try {
    // Step 1: Get all matchups with goals for this season
    console.log('📊 Step 1: Aggregating matchup stats...\n');
    
    const matchupStats = await sql`
      SELECT 
        m.home_player_id as player_id,
        m.home_player_name as player_name,
        COUNT(DISTINCT m.fixture_id) as matches_played,
        SUM(COALESCE(m.home_goals, 0)) as total_goals,
        SUM(CASE WHEN m.home_goals > m.away_goals THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN m.home_goals = m.away_goals THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN m.home_goals < m.away_goals THEN 1 ELSE 0 END) as losses
      FROM matchups m
      WHERE m.season_id = ${seasonId}
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      GROUP BY m.home_player_id, m.home_player_name
      
      UNION ALL
      
      SELECT 
        m.away_player_id as player_id,
        m.away_player_name as player_name,
        COUNT(DISTINCT m.fixture_id) as matches_played,
        SUM(COALESCE(m.away_goals, 0)) as total_goals,
        SUM(CASE WHEN m.away_goals > m.home_goals THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN m.away_goals = m.home_goals THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN m.away_goals < m.home_goals THEN 1 ELSE 0 END) as losses
      FROM matchups m
      WHERE m.season_id = ${seasonId}
        AND m.home_goals IS NOT NULL
        AND m.away_goals IS NOT NULL
      GROUP BY m.away_player_id, m.away_player_name
    `;

    // Aggregate by player (since they appear in both home and away)
    const playerMatchupStats = {};
    
    for (const stat of matchupStats) {
      if (!playerMatchupStats[stat.player_id]) {
        playerMatchupStats[stat.player_id] = {
          player_id: stat.player_id,
          player_name: stat.player_name,
          matches_played: 0,
          total_goals: 0,
          wins: 0,
          draws: 0,
          losses: 0
        };
      }
      
      playerMatchupStats[stat.player_id].matches_played += parseInt(stat.matches_played);
      playerMatchupStats[stat.player_id].total_goals += parseInt(stat.total_goals);
      playerMatchupStats[stat.player_id].wins += parseInt(stat.wins);
      playerMatchupStats[stat.player_id].draws += parseInt(stat.draws);
      playerMatchupStats[stat.player_id].losses += parseInt(stat.losses);
    }

    console.log(`✅ Found ${Object.keys(playerMatchupStats).length} players with matchup data\n`);

    // Step 2: Get player_seasons stats
    console.log('📊 Step 2: Fetching player_seasons stats...\n');
    
    const playerSeasonStats = await sql`
      SELECT 
        player_id,
        player_name,
        matches_played,
        goals_scored,
        wins,
        draws,
        losses
      FROM player_seasons
      WHERE season_id = ${seasonId}
    `;

    console.log(`✅ Found ${playerSeasonStats.length} players in player_seasons\n`);

    // Step 3: Compare stats
    console.log('🔍 Step 3: Comparing stats...\n');
    console.log('='.repeat(120));
    console.log('| Player Name'.padEnd(30) + '| Stat'.padEnd(20) + '| Matchups'.padEnd(15) + '| Player_Seasons'.padEnd(20) + '| Difference'.padEnd(15) + '| Status'.padEnd(10) + '|');
    console.log('='.repeat(120));

    let totalDiscrepancies = 0;
    let playersWithIssues = new Set();

    // Check each player from matchups
    for (const playerId in playerMatchupStats) {
      const matchupData = playerMatchupStats[playerId];
      const seasonData = playerSeasonStats.find(p => p.player_id === playerId);

      if (!seasonData) {
        console.log(`| ${matchupData.player_name.padEnd(28)} | ${'MISSING'.padEnd(18)} | ${'N/A'.padEnd(13)} | ${'NOT FOUND'.padEnd(18)} | ${'N/A'.padEnd(13)} | ❌ ERROR  |`);
        playersWithIssues.add(playerId);
        totalDiscrepancies++;
        continue;
      }

      // Compare each stat
      const comparisons = [
        {
          name: 'Matches Played',
          matchup: matchupData.matches_played,
          season: parseInt(seasonData.matches_played) || 0
        },
        {
          name: 'Goals Scored',
          matchup: matchupData.total_goals,
          season: parseInt(seasonData.goals_scored) || 0
        },
        {
          name: 'Wins',
          matchup: matchupData.wins,
          season: parseInt(seasonData.wins) || 0
        },
        {
          name: 'Draws',
          matchup: matchupData.draws,
          season: parseInt(seasonData.draws) || 0
        },
        {
          name: 'Losses',
          matchup: matchupData.losses,
          season: parseInt(seasonData.losses) || 0
        }
      ];

      for (const comp of comparisons) {
        const diff = comp.matchup - comp.season;
        const status = diff === 0 ? '✅ OK' : '❌ DIFF';
        
        if (diff !== 0) {
          console.log(
            `| ${matchupData.player_name.substring(0, 28).padEnd(28)} ` +
            `| ${comp.name.padEnd(18)} ` +
            `| ${comp.matchup.toString().padEnd(13)} ` +
            `| ${comp.season.toString().padEnd(18)} ` +
            `| ${(diff > 0 ? '+' : '') + diff.toString().padEnd(12)} ` +
            `| ${status.padEnd(8)} |`
          );
          playersWithIssues.add(playerId);
          totalDiscrepancies++;
        }
      }
    }

    // Check for players in player_seasons but not in matchups
    for (const seasonData of playerSeasonStats) {
      if (!playerMatchupStats[seasonData.player_id]) {
        const hasStats = seasonData.matches_played > 0 || seasonData.goals_scored > 0;
        if (hasStats) {
          console.log(
            `| ${seasonData.player_name.substring(0, 28).padEnd(28)} ` +
            `| ${'NO MATCHUPS'.padEnd(18)} ` +
            `| ${'0'.padEnd(13)} ` +
            `| ${seasonData.matches_played.toString().padEnd(18)} ` +
            `| ${('-' + seasonData.matches_played).padEnd(13)} ` +
            `| ⚠️  WARN   |`
          );
          playersWithIssues.add(seasonData.player_id);
          totalDiscrepancies++;
        }
      }
    }

    console.log('='.repeat(120));
    console.log('\n');

    // Step 4: Summary
    console.log('📈 Summary');
    console.log('==========\n');
    console.log(`Total Players in Matchups: ${Object.keys(playerMatchupStats).length}`);
    console.log(`Total Players in Player_Seasons: ${playerSeasonStats.length}`);
    console.log(`Players with Discrepancies: ${playersWithIssues.size}`);
    console.log(`Total Discrepancies Found: ${totalDiscrepancies}\n`);

    if (totalDiscrepancies === 0) {
      console.log('✅ All stats match perfectly! No discrepancies found.\n');
    } else {
      console.log(`❌ Found ${totalDiscrepancies} discrepancies across ${playersWithIssues.size} players.\n`);
      console.log('💡 Recommendations:');
      console.log('   1. Run recalculation script to sync player_seasons with matchup data');
      console.log('   2. Check for missing or duplicate matchup entries');
      console.log('   3. Verify fixture results were entered correctly\n');
    }

    // Step 5: Detailed breakdown for top discrepancies
    if (playersWithIssues.size > 0) {
      console.log('\n📋 Detailed Breakdown (Top 10 Players with Issues)');
      console.log('===================================================\n');

      let count = 0;
      for (const playerId of playersWithIssues) {
        if (count >= 10) break;
        
        const matchupData = playerMatchupStats[playerId];
        const seasonData = playerSeasonStats.find(p => p.player_id === playerId);

        console.log(`Player: ${matchupData?.player_name || seasonData?.player_name || 'Unknown'} (${playerId})`);
        console.log('─'.repeat(60));
        
        if (matchupData && seasonData) {
          console.log(`  Matches:  Matchups=${matchupData.matches_played}, Seasons=${seasonData.matches_played}, Diff=${matchupData.matches_played - seasonData.matches_played}`);
          console.log(`  Goals:    Matchups=${matchupData.total_goals}, Seasons=${seasonData.goals_scored}, Diff=${matchupData.total_goals - seasonData.goals_scored}`);
          console.log(`  Wins:     Matchups=${matchupData.wins}, Seasons=${seasonData.wins}, Diff=${matchupData.wins - seasonData.wins}`);
          console.log(`  Draws:    Matchups=${matchupData.draws}, Seasons=${seasonData.draws}, Diff=${matchupData.draws - seasonData.draws}`);
          console.log(`  Losses:   Matchups=${matchupData.losses}, Seasons=${seasonData.losses}, Diff=${matchupData.losses - seasonData.losses}`);
        } else if (matchupData) {
          console.log(`  ❌ Player has matchup data but NOT in player_seasons`);
          console.log(`  Matchups: ${matchupData.matches_played} matches, ${matchupData.total_goals} goals`);
        } else if (seasonData) {
          console.log(`  ⚠️  Player in player_seasons but NO matchup data`);
          console.log(`  Seasons: ${seasonData.matches_played} matches, ${seasonData.goals_scored} goals`);
        }
        
        console.log('');
        count++;
      }
    }

    // Step 6: Export discrepancies to JSON
    if (totalDiscrepancies > 0) {
      const fs = require('fs');
      const discrepancyReport = {
        season_id: seasonId,
        generated_at: new Date().toISOString(),
        summary: {
          total_players_matchups: Object.keys(playerMatchupStats).length,
          total_players_seasons: playerSeasonStats.length,
          players_with_issues: playersWithIssues.size,
          total_discrepancies: totalDiscrepancies
        },
        discrepancies: []
      };

      for (const playerId of playersWithIssues) {
        const matchupData = playerMatchupStats[playerId];
        const seasonData = playerSeasonStats.find(p => p.player_id === playerId);

        discrepancyReport.discrepancies.push({
          player_id: playerId,
          player_name: matchupData?.player_name || seasonData?.player_name || 'Unknown',
          matchup_stats: matchupData || null,
          season_stats: seasonData ? {
            matches_played: seasonData.matches_played,
            goals_scored: seasonData.goals_scored,
            wins: seasonData.wins,
            draws: seasonData.draws,
            losses: seasonData.losses
          } : null,
          differences: matchupData && seasonData ? {
            matches_played: matchupData.matches_played - seasonData.matches_played,
            goals_scored: matchupData.total_goals - seasonData.goals_scored,
            wins: matchupData.wins - seasonData.wins,
            draws: matchupData.draws - seasonData.draws,
            losses: matchupData.losses - seasonData.losses
          } : null
        });
      }

      const filename = `matchup-stats-discrepancies-${seasonId}-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(discrepancyReport, null, 2));
      console.log(`\n💾 Discrepancy report saved to: ${filename}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();
