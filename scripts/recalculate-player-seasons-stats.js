require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function recalculatePlayerSeasonsStats() {
  if (!process.env.NEON_TOURNAMENT_DB_URL) {
    console.error('❌ NEON_TOURNAMENT_DB_URL not found in environment variables');
    process.exit(1);
  }

  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  const seasonId = 'SSPSLS16';

  console.log('🔄 Recalculating player_seasons statistics from matchups...\n');
  console.log(`Season: ${seasonId}\n`);

  try {
    // First, check how many matchups have goals entered from completed fixtures
    const matchupCheck = await sql`
      SELECT 
        COUNT(DISTINCT m.id) as total_matchups,
        COUNT(DISTINCT CASE WHEN f.status = 'completed' THEN m.id END) as completed_matchups,
        COUNT(DISTINCT f.tournament_id) as tournaments
      FROM matchups m
      JOIN fixtures f ON m.fixture_id = f.id
      WHERE f.season_id = ${seasonId}
    `;

    console.log('📊 Matchups Status:');
    console.log(`  Total matchups: ${matchupCheck[0].total_matchups}`);
    console.log(`  Completed matchups: ${matchupCheck[0].completed_matchups}`);
    console.log(`  Tournaments: ${matchupCheck[0].tournaments}\n`);

    if (matchupCheck[0].completed_matchups === 0) {
      console.log('⚠️  WARNING: No completed fixtures found!');
      console.log('   Fixtures need to be marked as completed before stats can be calculated.\n');
    }

    // Get all players for the season
    const players = await sql`
      SELECT player_id, player_name, team_id, team
      FROM player_seasons
      WHERE season_id = ${seasonId}
    `;

    console.log(`📊 Found ${players.length} players to process\n`);

    let updated = 0;
    let errors = 0;
    let skipped = 0;

    for (const player of players) {
      try {
        // Get all matchups for this player from COMPLETED fixtures only
        // Join with fixtures to filter by status and get proper tournament context
        const matchups = await sql`
          SELECT 
            m.home_player_id,
            m.away_player_id,
            m.home_goals,
            m.away_goals,
            f.motm_player_id,
            f.status
          FROM matchups m
          JOIN fixtures f ON m.fixture_id = f.id
          WHERE (m.home_player_id = ${player.player_id} OR m.away_player_id = ${player.player_id})
            AND f.season_id = ${seasonId}
            AND f.status = 'completed'
        `;

        // Calculate stats from matchups
        let matches_played = 0;
        let goals_scored = 0;
        let goals_conceded = 0;
        let wins = 0;
        let draws = 0;
        let losses = 0;
        let clean_sheets = 0;
        let motm_awards = 0;

        matchups.forEach(matchup => {
          const isHome = matchup.home_player_id === player.player_id;
          const playerGoals = isHome ? (matchup.home_goals || 0) : (matchup.away_goals || 0);
          const opponentGoals = isHome ? (matchup.away_goals || 0) : (matchup.home_goals || 0);

          matches_played++;
          goals_scored += playerGoals;
          goals_conceded += opponentGoals;

          if (playerGoals > opponentGoals) wins++;
          else if (playerGoals === opponentGoals) draws++;
          else losses++;

          if (opponentGoals === 0) clean_sheets++;
          if (matchup.motm_player_id === player.player_id) motm_awards++;
        });

        // Update player_seasons with calculated stats
        await sql`
          UPDATE player_seasons
          SET 
            matches_played = ${matches_played},
            goals_scored = ${goals_scored},
            goals_conceded = ${goals_conceded},
            wins = ${wins},
            draws = ${draws},
            losses = ${losses},
            clean_sheets = ${clean_sheets},
            motm_awards = ${motm_awards}
          WHERE player_id = ${player.player_id}
            AND season_id = ${seasonId}
        `;

        updated++;
        
        if (matches_played > 0) {
          console.log(`✅ ${player.player_name} (${player.team || 'No Team'}): ${matches_played}MP, ${goals_scored}G-${goals_conceded}GC, ${wins}W-${draws}D-${losses}L, ${clean_sheets}CS, ${motm_awards}MOTM`);
        } else if (motm_awards > 0) {
          console.log(`✅ ${player.player_name} (${player.team || 'No Team'}): 0MP, ${motm_awards}MOTM (no match data yet)`);
        } else {
          skipped++;
        }

      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${player.player_name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📈 RECALCULATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Players: ${players.length}`);
    console.log(`✅ Successfully Updated: ${updated}`);
    console.log(`⚠️  Skipped (no data): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(80));

    // Show sample of updated stats
    console.log('\n📊 Sample of Updated Stats:');
    const sample = await sql`
      SELECT 
        player_name,
        team,
        matches_played,
        goals_scored,
        goals_conceded,
        wins,
        draws,
        losses,
        clean_sheets,
        motm_awards
      FROM player_seasons
      WHERE season_id = ${seasonId}
        AND (matches_played > 0 OR motm_awards > 0)
      ORDER BY matches_played DESC, goals_scored DESC
      LIMIT 10
    `;

    if (sample.length > 0) {
      console.log('\nTop 10 Players by Matches Played:');
      console.log('─'.repeat(120));
      console.log('Player Name'.padEnd(25) + 'Team'.padEnd(20) + 'MP'.padEnd(6) + 'G'.padEnd(6) + 'GC'.padEnd(6) + 'W'.padEnd(6) + 'D'.padEnd(6) + 'L'.padEnd(6) + 'CS'.padEnd(6) + 'MOTM');
      console.log('─'.repeat(120));
      
      sample.forEach(p => {
        console.log(
          p.player_name.padEnd(25) +
          (p.team || 'N/A').padEnd(20) +
          String(p.matches_played).padEnd(6) +
          String(p.goals_scored).padEnd(6) +
          String(p.goals_conceded).padEnd(6) +
          String(p.wins).padEnd(6) +
          String(p.draws).padEnd(6) +
          String(p.losses).padEnd(6) +
          String(p.clean_sheets).padEnd(6) +
          String(p.motm_awards)
        );
      });
    } else {
      console.log('\n⚠️  No players with match data or MOTM awards found.');
      console.log('   This is expected if match results haven\'t been entered yet.');
    }

    console.log('\n✅ Recalculation complete!');
    
    if (matchupCheck[0].completed_matchups === 0) {
      console.log('\n💡 TIP: Mark fixtures as completed to calculate player statistics.');
      console.log('   Fixtures must have status = \'completed\' to be included in stats.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

recalculatePlayerSeasonsStats().catch(console.error);
