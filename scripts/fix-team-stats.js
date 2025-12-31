require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function fixTeamStats() {
    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔧 Fix Team Stats Script\n');
    console.log('This will recalculate all team stats from actual match results.\n');

    try {
        const seasonId = 'SSPSLS16';

        // Fetch all team stats
        const teamStats = await sql`
      SELECT team_id, team_name
      FROM teamstats
      WHERE season_id = ${seasonId}
      ORDER BY team_name
    `;

        console.log(`📊 Found ${teamStats.length} teams\n`);

        const updates = [];

        // Calculate correct stats for each team
        for (const stats of teamStats) {
            const teamId = stats.team_id;
            const teamName = stats.team_name;

            // Get all completed fixtures for this team
            const fixtures = await sql`
        SELECT 
          home_team_id, away_team_id,
          home_score, away_score
        FROM fixtures
        WHERE season_id = ${seasonId}
          AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
          AND status = 'completed'
      `;

            let wins = 0;
            let draws = 0;
            let losses = 0;
            let goalsFor = 0;
            let goalsAgainst = 0;

            fixtures.forEach(fixture => {
                const isHome = fixture.home_team_id === teamId;
                const teamScore = isHome ? fixture.home_score : fixture.away_score;
                const opponentScore = isHome ? fixture.away_score : fixture.home_score;

                goalsFor += teamScore || 0;
                goalsAgainst += opponentScore || 0;

                if (teamScore > opponentScore) {
                    wins++;
                } else if (teamScore === opponentScore) {
                    draws++;
                } else {
                    losses++;
                }
            });

            const matchesPlayed = fixtures.length;
            const goalDifference = goalsFor - goalsAgainst;
            const points = (wins * 3) + draws;

            updates.push({
                teamId,
                teamName,
                matchesPlayed,
                wins,
                draws,
                losses,
                goalsFor,
                goalsAgainst,
                goalDifference,
                points
            });

            console.log(`${teamName}:`);
            console.log(`  Matches: ${matchesPlayed}, W:${wins} D:${draws} L:${losses}`);
            console.log(`  Goals: ${goalsFor}-${goalsAgainst} (${goalDifference > 0 ? '+' : ''}${goalDifference}), Points: ${points}`);
        }

        console.log(`\n📝 Ready to update ${updates.length} teams`);
        const answer = await askQuestion('\nProceed with updates? (yes/no): ');

        if (answer.toLowerCase() !== 'yes') {
            console.log('❌ Update cancelled');
            rl.close();
            return;
        }

        console.log('\n🔄 Updating team stats...\n');

        for (const update of updates) {
            await sql`
        UPDATE teamstats
        SET 
          matches_played = ${update.matchesPlayed},
          wins = ${update.wins},
          draws = ${update.draws},
          losses = ${update.losses},
          goals_for = ${update.goalsFor},
          goals_against = ${update.goalsAgainst},
          goal_difference = ${update.goalDifference},
          points = ${update.points},
          updated_at = NOW()
        WHERE team_id = ${update.teamId}
          AND season_id = ${seasonId}
      `;

            console.log(`✅ Updated ${update.teamName}`);
        }

        console.log('\n✅ All team stats have been fixed!');
        console.log('\n🏆 Final Standings:');

        // Show final standings
        const finalStandings = updates.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        });

        finalStandings.forEach((team, index) => {
            const position = index + 1;
            console.log(`${position}. ${team.teamName.padEnd(25)} ${team.points}pts (${team.wins}W ${team.draws}D ${team.losses}L, GD: ${team.goalDifference > 0 ? '+' : ''}${team.goalDifference})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        rl.close();
    }
}

fixTeamStats();
