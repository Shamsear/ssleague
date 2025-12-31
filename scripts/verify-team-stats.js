require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function verifyTeamStats() {
    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Verifying Team Stats against Matchday Results...\n');

    try {
        // Get the current season ID (you can change this)
        const seasonId = 'SSPSLS16';

        // Fetch all team stats for the season
        const teamStats = await sql`
      SELECT 
        team_id, team_name, 
        matches_played, wins, draws, losses,
        goals_for, goals_against, goal_difference, points
      FROM teamstats
      WHERE season_id = ${seasonId}
      ORDER BY team_name
    `;

        console.log(`📊 Found ${teamStats.length} teams in team_stats\n`);

        // For each team, calculate actual stats from fixtures
        for (const stats of teamStats) {
            const teamId = stats.team_id;
            const teamName = stats.team_name;

            // Get all fixtures for this team
            const fixtures = await sql`
        SELECT 
          id, round_number, leg,
          home_team_id, away_team_id,
          home_score, away_score,
          status
        FROM fixtures
        WHERE season_id = ${seasonId}
          AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
          AND status = 'completed'
        ORDER BY round_number, leg
      `;

            // Calculate actual stats
            let actualWins = 0;
            let actualDraws = 0;
            let actualLosses = 0;
            let actualGoalsFor = 0;
            let actualGoalsAgainst = 0;
            let actualMatchesPlayed = fixtures.length;

            fixtures.forEach(fixture => {
                const isHome = fixture.home_team_id === teamId;
                const teamScore = isHome ? fixture.home_score : fixture.away_score;
                const opponentScore = isHome ? fixture.away_score : fixture.home_score;

                actualGoalsFor += teamScore || 0;
                actualGoalsAgainst += opponentScore || 0;

                if (teamScore > opponentScore) {
                    actualWins++;
                } else if (teamScore === opponentScore) {
                    actualDraws++;
                } else {
                    actualLosses++;
                }
            });

            const actualGoalDifference = actualGoalsFor - actualGoalsAgainst;
            const actualPoints = (actualWins * 3) + actualDraws;

            // Compare with stored stats
            const hasError =
                stats.matches_played !== actualMatchesPlayed ||
                stats.wins !== actualWins ||
                stats.draws !== actualDraws ||
                stats.losses !== actualLosses ||
                stats.goals_for !== actualGoalsFor ||
                stats.goals_against !== actualGoalsAgainst ||
                stats.goal_difference !== actualGoalDifference ||
                stats.points !== actualPoints;

            if (hasError) {
                console.log(`❌ MISMATCH: ${teamName}`);
                console.log('   Stored Stats vs Actual Stats:');

                if (stats.matches_played !== actualMatchesPlayed) {
                    console.log(`   Matches: ${stats.matches_played} vs ${actualMatchesPlayed} ❌`);
                }
                if (stats.wins !== actualWins) {
                    console.log(`   Wins: ${stats.wins} vs ${actualWins} ❌`);
                }
                if (stats.draws !== actualDraws) {
                    console.log(`   Draws: ${stats.draws} vs ${actualDraws} ❌`);
                }
                if (stats.losses !== actualLosses) {
                    console.log(`   Losses: ${stats.losses} vs ${actualLosses} ❌`);
                }
                if (stats.goals_for !== actualGoalsFor) {
                    console.log(`   Goals For: ${stats.goals_for} vs ${actualGoalsFor} ❌`);
                }
                if (stats.goals_against !== actualGoalsAgainst) {
                    console.log(`   Goals Against: ${stats.goals_against} vs ${actualGoalsAgainst} ❌`);
                }
                if (stats.goal_difference !== actualGoalDifference) {
                    console.log(`   Goal Diff: ${stats.goal_difference} vs ${actualGoalDifference} ❌`);
                }
                if (stats.points !== actualPoints) {
                    console.log(`   Points: ${stats.points} vs ${actualPoints} ❌`);
                }
                console.log('');
            } else {
                console.log(`✅ ${teamName}: All stats match (${actualMatchesPlayed} matches, ${actualWins}W ${actualDraws}D ${actualLosses}L)`);
            }
        }

        console.log('\n✅ Verification complete!');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyTeamStats();
