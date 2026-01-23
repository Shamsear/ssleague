/**
 * Diagnostic script to check which teams are in CL/PL fixtures
 * 
 * Run this with: node scripts/check-team-fixtures.js <team_id>
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTeamFixtures() {
    if (!process.env.NEON_TOURNAMENT_DB_URL) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL environment variable not found');
        process.exit(1);
    }

    const teamId = process.argv[2];

    if (!teamId) {
        console.error('❌ Error: Please provide a team_id');
        console.error('Usage: node scripts/check-team-fixtures.js <team_id>');
        console.error('\nExample team IDs to try:');
        console.error('  - SSPSLT0001');
        console.error('  - SSPSLT0002');
        console.error('  - etc.');
        process.exit(1);
    }

    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log(`🔍 Checking fixtures for team: ${teamId}\n`);
    console.log('='.repeat(70));

    try {
        // 1. Check if team exists
        console.log('\n📊 Step 1: Checking if team exists in any fixtures');
        const allTeamFixtures = await sql`
      SELECT 
        f.id,
        f.tournament_id,
        f.season_id,
        f.round_number,
        f.leg,
        f.home_team_id,
        f.home_team_name,
        f.away_team_id,
        f.away_team_name,
        f.status as fixture_status,
        t.tournament_name
      FROM fixtures f
      LEFT JOIN tournaments t ON f.tournament_id = t.id
      WHERE f.home_team_id = ${teamId} OR f.away_team_id = ${teamId}
      ORDER BY f.round_number DESC
    `;

        if (allTeamFixtures.length === 0) {
            console.log(`❌ No fixtures found for team ${teamId}`);
            console.log('\nPossible issues:');
            console.log('1. Team ID is incorrect');
            console.log('2. Team has not been assigned to any fixtures');
            console.log('3. Fixtures have not been created yet');

            // Show some example team IDs
            console.log('\n📋 Here are some teams that DO have fixtures:');
            const sampleTeams = await sql`
        SELECT DISTINCT home_team_id, home_team_name
        FROM fixtures
        WHERE tournament_id LIKE '%SSPSLS16%'
        LIMIT 10
      `;
            sampleTeams.forEach(t => {
                console.log(`  - ${t.home_team_id}: ${t.home_team_name}`);
            });

            return;
        }

        console.log(`✅ Found ${allTeamFixtures.length} fixtures for this team\n`);

        // Group by tournament
        const byTournament = {};
        allTeamFixtures.forEach(f => {
            const tournamentName = f.tournament_name || f.tournament_id;
            if (!byTournament[tournamentName]) {
                byTournament[tournamentName] = [];
            }
            byTournament[tournamentName].push(f);
        });

        // 2. Show fixtures by tournament
        console.log('📊 Step 2: Fixtures by tournament\n');

        for (const [tournamentName, fixtures] of Object.entries(byTournament)) {
            console.log(`🏆 ${tournamentName}: ${fixtures.length} fixtures`);

            // Get round deadlines for this tournament
            const tournamentId = fixtures[0].tournament_id;
            const roundDeadlines = await sql`
        SELECT round_number, leg, status, scheduled_date
        FROM round_deadlines
        WHERE tournament_id = ${tournamentId}
      `;

            const deadlineMap = new Map();
            roundDeadlines.forEach(rd => {
                deadlineMap.set(`${rd.round_number}_${rd.leg}`, rd);
            });

            // Categorize
            let active = 0, upcoming = 0, completed = 0, uncategorized = 0;

            fixtures.forEach(f => {
                const key = `${f.round_number}_${f.leg}`;
                const deadline = deadlineMap.get(key);

                if (!deadline) {
                    uncategorized++;
                    console.log(`  ❌ Round ${f.round_number} (${f.leg}): NO DEADLINE - ${f.home_team_name} vs ${f.away_team_name}`);
                    return;
                }

                const hasScores = f.home_score !== null && f.away_score !== null;
                const isCompleted = hasScores && (f.fixture_status === 'completed' || f.fixture_status === 'closed');
                const isActive = !isCompleted && deadline.status === 'active';
                const isUpcoming = !isCompleted && !isActive && (deadline.status === 'pending' || deadline.status === 'paused');

                if (isCompleted) completed++;
                else if (isActive) {
                    active++;
                    console.log(`  ✅ ACTIVE Round ${f.round_number}: ${f.home_team_name} vs ${f.away_team_name}`);
                }
                else if (isUpcoming) {
                    upcoming++;
                    console.log(`  📅 UPCOMING Round ${f.round_number}: ${f.home_team_name} vs ${f.away_team_name}`);
                }
                else {
                    uncategorized++;
                    console.log(`  ⚠️  UNCATEGORIZED Round ${f.round_number}: ${f.home_team_name} vs ${f.away_team_name}`);
                    console.log(`      Status: ${deadline.status}, Has scores: ${hasScores}`);
                }
            });

            console.log(`  Summary: ${active} active, ${upcoming} upcoming, ${completed} completed, ${uncategorized} uncategorized\n`);
        }

        // 3. Check what the matches page API would return
        console.log('📊 Step 3: Testing /api/fixtures/team endpoint\n');
        const seasonId = allTeamFixtures[0]?.season_id;

        if (seasonId) {
            console.log(`Season ID: ${seasonId}`);
            console.log(`Team ID: ${teamId}`);
            console.log(`\nAPI would be called with:`);
            console.log(`  GET /api/fixtures/team?team_id=${teamId}&season_id=${seasonId}`);
            console.log(`\nThis should return ${allTeamFixtures.length} fixtures`);
        }

        console.log('\n='.repeat(70));
        console.log('✅ Diagnosis complete!');

    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
        console.error(error.stack);
    }
}

// Run the diagnosis
checkTeamFixtures().catch(console.error);
