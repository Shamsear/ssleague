/**
 * Diagnostic script to check why fixtures are not showing up for teams
 * 
 * Run this with: node scripts/diagnose-missing-fixtures.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function diagnoseMissingFixtures() {
    if (!process.env.NEON_TOURNAMENT_DB_URL) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL environment variable not found');
        console.error('Make sure .env.local file exists with NEON_TOURNAMENT_DB_URL');
        process.exit(1);
    }

    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Diagnosing Missing Fixtures Issue\n');
    console.log('='.repeat(60));

    try {
        // 1. Check all fixtures
        console.log('\n📊 Step 1: Checking all fixtures in database');
        const allFixtures = await sql`
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
        f.home_score,
        f.away_score
      FROM fixtures f
      ORDER BY f.round_number DESC, f.match_number ASC
      LIMIT 20
    `;

        console.log(`Found ${allFixtures.length} fixtures (showing first 20)`);
        if (allFixtures.length > 0) {
            console.log('\nSample fixtures:');
            allFixtures.slice(0, 5).forEach(f => {
                console.log(`  - Round ${f.round_number} (${f.leg}): ${f.home_team_name} vs ${f.away_team_name}`);
                console.log(`    Status: ${f.fixture_status}, Scores: ${f.home_score ?? '-'} - ${f.away_score ?? '-'}`);
                console.log(`    Tournament: ${f.tournament_id}, Season: ${f.season_id}`);
            });
        }

        // 2. Check round_deadlines
        console.log('\n📅 Step 2: Checking round_deadlines');
        const roundDeadlines = await sql`
      SELECT 
        rd.tournament_id,
        rd.season_id,
        rd.round_number,
        rd.leg,
        rd.status,
        rd.scheduled_date,
        rd.home_fixture_deadline_time,
        rd.away_fixture_deadline_time
      FROM round_deadlines rd
      ORDER BY rd.round_number DESC
      LIMIT 20
    `;

        console.log(`Found ${roundDeadlines.length} round deadlines (showing first 20)`);
        if (roundDeadlines.length > 0) {
            console.log('\nRound deadline statuses:');
            roundDeadlines.forEach(rd => {
                console.log(`  - Round ${rd.round_number} (${rd.leg}): status = "${rd.status}"`);
                console.log(`    Tournament: ${rd.tournament_id}, Scheduled: ${rd.scheduled_date || 'Not scheduled'}`);
            });
        }

        // 3. Check for fixtures WITHOUT matching round_deadlines
        console.log('\n⚠️  Step 3: Checking fixtures without round_deadlines');
        const fixturesWithoutDeadlines = await sql`
      SELECT 
        f.id,
        f.tournament_id,
        f.round_number,
        f.leg,
        f.home_team_name,
        f.away_team_name
      FROM fixtures f
      LEFT JOIN round_deadlines rd 
        ON f.tournament_id = rd.tournament_id 
        AND f.round_number = rd.round_number 
        AND f.leg = rd.leg
      WHERE rd.id IS NULL
      LIMIT 10
    `;

        if (fixturesWithoutDeadlines.length > 0) {
            console.log(`❌ Found ${fixturesWithoutDeadlines.length} fixtures WITHOUT round_deadlines:`);
            fixturesWithoutDeadlines.forEach(f => {
                console.log(`  - Round ${f.round_number} (${f.leg}): ${f.home_team_name} vs ${f.away_team_name}`);
                console.log(`    Tournament: ${f.tournament_id}`);
                console.log(`    ⚠️  This fixture won't show up because it has no round_deadline!`);
            });
        } else {
            console.log('✅ All fixtures have matching round_deadlines');
        }

        // 4. Check round_deadline status values
        console.log('\n📈 Step 4: Analyzing round_deadline status distribution');
        const statusDistribution = await sql`
      SELECT status, COUNT(*) as count
      FROM round_deadlines
      GROUP BY status
      ORDER BY count DESC
    `;

        console.log('Status distribution:');
        statusDistribution.forEach(s => {
            console.log(`  - "${s.status}": ${s.count} rounds`);
        });

        // 5. Categorize fixtures based on matches page logic
        console.log('\n🎯 Step 5: Categorizing fixtures (matches page logic)');

        const fixturesWithStatus = await sql`
      SELECT 
        f.id,
        f.round_number,
        f.leg,
        f.home_team_name,
        f.away_team_name,
        f.status as fixture_status,
        f.home_score,
        f.away_score,
        rd.status as round_status
      FROM fixtures f
      LEFT JOIN round_deadlines rd 
        ON f.tournament_id = rd.tournament_id 
        AND f.round_number = rd.round_number 
        AND f.leg = rd.leg
      ORDER BY f.round_number DESC
      LIMIT 20
    `;

        let activeCount = 0;
        let upcomingCount = 0;
        let completedCount = 0;
        let uncategorizedCount = 0;

        fixturesWithStatus.forEach(f => {
            const hasScores = f.home_score !== null && f.away_score !== null;
            const isCompleted = hasScores && (f.fixture_status === 'completed' || f.fixture_status === 'closed');
            const isActive = !isCompleted && f.round_status === 'active';
            const isUpcoming = !isCompleted && !isActive && (f.round_status === 'pending' || f.round_status === 'paused' || !f.round_status);

            if (isCompleted) {
                completedCount++;
            } else if (isActive) {
                activeCount++;
            } else if (isUpcoming) {
                upcomingCount++;
            } else {
                uncategorizedCount++;
                console.log(`  ⚠️  UNCATEGORIZED: Round ${f.round_number} - ${f.home_team_name} vs ${f.away_team_name}`);
                console.log(`      round_status: "${f.round_status}", fixture_status: "${f.fixture_status}"`);
                console.log(`      has_scores: ${hasScores}`);
            }
        });

        console.log(`\nCategorization results (first 20 fixtures):`);
        console.log(`  ✅ Active: ${activeCount}`);
        console.log(`  📅 Upcoming: ${upcomingCount}`);
        console.log(`  ✔️  Completed: ${completedCount}`);
        console.log(`  ❌ Uncategorized: ${uncategorizedCount}`);

        // 6. Recommendations
        console.log('\n💡 Recommendations:');
        console.log('='.repeat(60));

        if (fixturesWithoutDeadlines.length > 0) {
            console.log('❌ ISSUE FOUND: Some fixtures don\'t have round_deadlines');
            console.log('   Fix: Create round_deadlines for these rounds via committee dashboard');
            console.log('   Path: /dashboard/committee/round-control');
        }

        if (uncategorizedCount > 0) {
            console.log('❌ ISSUE FOUND: Some fixtures are not categorized');
            console.log('   Possible causes:');
            console.log('   1. round_status has unexpected value (not active/pending/paused/completed)');
            console.log('   2. fixture_status is not set correctly');
            console.log('   Fix: Update round_deadlines.status to "active", "pending", or "completed"');
        }

        if (statusDistribution.some(s => !['active', 'pending', 'paused', 'completed', 'closed'].includes(s.status))) {
            console.log('⚠️  WARNING: Some rounds have non-standard status values');
            console.log('   Standard values: active, pending, paused, completed, closed');
            console.log('   Fix: Update round_deadlines.status to use standard values');
        }

        console.log('\n✅ Diagnosis complete!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
        console.error(error.stack);
    }
}

// Run the diagnosis
diagnoseMissingFixtures().catch(console.error);
