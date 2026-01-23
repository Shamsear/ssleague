/**
 * Diagnostic script to check Champions League and Pro League fixtures
 * 
 * Run this with: node scripts/diagnose-cl-pl-fixtures.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function diagnoseChampionsLeagueAndProLeague() {
    if (!process.env.NEON_TOURNAMENT_DB_URL) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL environment variable not found');
        process.exit(1);
    }

    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Diagnosing Champions League & Pro League Fixtures\n');
    console.log('='.repeat(70));

    try {
        // 1. Find Champions League and Pro League tournaments
        console.log('\n📊 Step 1: Finding Champions League & Pro League tournaments');
        const tournaments = await sql`
      SELECT id, tournament_name, season_id, status
      FROM tournaments
      WHERE LOWER(tournament_name) LIKE '%champions%league%'
         OR LOWER(tournament_name) LIKE '%pro%league%'
      ORDER BY created_at DESC
    `;

        console.log(`Found ${tournaments.length} tournaments:`);
        tournaments.forEach(t => {
            console.log(`  - ${t.tournament_name} (${t.id})`);
            console.log(`    Season: ${t.season_id}, Status: ${t.status}`);
        });

        if (tournaments.length === 0) {
            console.log('❌ No Champions League or Pro League tournaments found!');
            return;
        }

        // 2. Check fixtures for each tournament
        for (const tournament of tournaments) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`\n🏆 Analyzing: ${tournament.tournament_name}`);
            console.log(`   Tournament ID: ${tournament.id}`);

            // Get fixtures
            const fixtures = await sql`
        SELECT 
          f.id,
          f.round_number,
          f.leg,
          f.home_team_id,
          f.home_team_name,
          f.away_team_id,
          f.away_team_name,
          f.status as fixture_status,
          f.home_score,
          f.away_score
        FROM fixtures f
        WHERE f.tournament_id = ${tournament.id}
        ORDER BY f.round_number DESC, f.match_number ASC
      `;

            console.log(`\n   Found ${fixtures.length} fixtures`);

            if (fixtures.length === 0) {
                console.log('   ❌ No fixtures found for this tournament!');
                continue;
            }

            // Get round deadlines
            const roundDeadlines = await sql`
        SELECT 
          rd.round_number,
          rd.leg,
          rd.status,
          rd.scheduled_date,
          rd.home_fixture_deadline_time,
          rd.away_fixture_deadline_time
        FROM round_deadlines rd
        WHERE rd.tournament_id = ${tournament.id}
        ORDER BY rd.round_number DESC
      `;

            console.log(`   Found ${roundDeadlines.length} round deadlines`);

            // Create a map of round deadlines
            const deadlineMap = new Map();
            roundDeadlines.forEach(rd => {
                const key = `${rd.round_number}_${rd.leg}`;
                deadlineMap.set(key, rd);
            });

            // Categorize fixtures
            let activeCount = 0;
            let upcomingCount = 0;
            let completedCount = 0;
            let missingDeadlineCount = 0;

            console.log('\n   📋 Fixture Analysis:');

            fixtures.forEach(f => {
                const key = `${f.round_number}_${f.leg}`;
                const deadline = deadlineMap.get(key);

                if (!deadline) {
                    missingDeadlineCount++;
                    console.log(`   ❌ Round ${f.round_number} (${f.leg}): ${f.home_team_name} vs ${f.away_team_name}`);
                    console.log(`      NO ROUND_DEADLINE FOUND!`);
                    return;
                }

                const hasScores = f.home_score !== null && f.away_score !== null;
                const isCompleted = hasScores && (f.fixture_status === 'completed' || f.fixture_status === 'closed');
                const isActive = !isCompleted && deadline.status === 'active';
                const isUpcoming = !isCompleted && !isActive && (deadline.status === 'pending' || deadline.status === 'paused' || !deadline.status);

                if (isCompleted) {
                    completedCount++;
                } else if (isActive) {
                    activeCount++;
                    console.log(`   ✅ ACTIVE: Round ${f.round_number} (${f.leg}): ${f.home_team_name} vs ${f.away_team_name}`);
                    console.log(`      Round status: ${deadline.status}, Scheduled: ${deadline.scheduled_date || 'Not set'}`);
                } else if (isUpcoming) {
                    upcomingCount++;
                    console.log(`   📅 UPCOMING: Round ${f.round_number} (${f.leg}): ${f.home_team_name} vs ${f.away_team_name}`);
                    console.log(`      Round status: ${deadline.status}, Scheduled: ${deadline.scheduled_date || 'Not set'}`);
                } else {
                    console.log(`   ⚠️  UNCATEGORIZED: Round ${f.round_number} (${f.leg}): ${f.home_team_name} vs ${f.away_team_name}`);
                    console.log(`      Round status: ${deadline.status}, Fixture status: ${f.fixture_status}`);
                    console.log(`      Has scores: ${hasScores}`);
                }
            });

            console.log(`\n   📊 Summary for ${tournament.tournament_name}:`);
            console.log(`      Active: ${activeCount}`);
            console.log(`      Upcoming: ${upcomingCount}`);
            console.log(`      Completed: ${completedCount}`);
            console.log(`      Missing Deadline: ${missingDeadlineCount}`);

            // Recommendations
            if (missingDeadlineCount > 0) {
                console.log(`\n   ❌ ISSUE: ${missingDeadlineCount} fixtures don't have round_deadlines`);
                console.log(`      Fix: Create round_deadlines via /dashboard/committee/round-control`);
            }

            if (activeCount === 0 && upcomingCount === 0 && completedCount < fixtures.length) {
                console.log(`\n   ❌ ISSUE: No active or upcoming fixtures found`);
                console.log(`      Possible causes:`);
                console.log(`      1. All round_deadlines have status = "completed" or "closed"`);
                console.log(`      2. Round_deadlines are missing`);
                console.log(`      Fix: Update round_deadlines.status to "active" or "pending"`);
            }
        }

        console.log(`\n${'='.repeat(70)}`);
        console.log('\n✅ Diagnosis complete!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
        console.error(error.stack);
    }
}

// Run the diagnosis
diagnoseChampionsLeagueAndProLeague().catch(console.error);
