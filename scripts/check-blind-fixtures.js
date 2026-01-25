/**
 * Simple script to check blind lineup fixture status
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkBlindFixtures() {
    if (!process.env.NEON_TOURNAMENT_DB_URL) {
        console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found');
        process.exit(1);
    }

    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Checking blind lineup fixtures...\n');

    try {
        // Find blind_lineup fixtures
        const fixtures = await sql`
      SELECT 
        f.id,
        f.tournament_id,
        f.home_team_name,
        f.away_team_name,
        f.round_number,
        f.leg,
        f.matchup_mode,
        f.home_lineup_submitted,
        f.away_lineup_submitted,
        f.lineups_locked,
        (SELECT COUNT(*) FROM matchups m WHERE m.fixture_id = f.id) as matchup_count
      FROM fixtures f
      WHERE f.matchup_mode = 'blind_lineup'
      ORDER BY f.round_number DESC
      LIMIT 10
    `;

        console.log(`Found ${fixtures.length} blind lineup fixtures:\n`);

        fixtures.forEach(f => {
            console.log(`📋 ${f.home_team_name} vs ${f.away_team_name}`);
            console.log(`   Round ${f.round_number} (${f.leg}), Fixture ID: ${f.id}`);
            console.log(`   Home submitted: ${f.home_lineup_submitted ? '✅' : '❌'}`);
            console.log(`   Away submitted: ${f.away_lineup_submitted ? '✅' : '❌'}`);
            console.log(`   Lineups locked: ${f.lineups_locked ? '🔒' : '🔓'}`);
            console.log(`   Matchups: ${f.matchup_count}`);

            const bothSubmitted = f.home_lineup_submitted && f.away_lineup_submitted;
            const needsMatchups = bothSubmitted && !f.lineups_locked && f.matchup_count === 0;

            if (needsMatchups) {
                console.log(`   ⚠️  READY FOR MATCHUP CREATION!`);
            } else if (bothSubmitted && f.matchup_count > 0) {
                console.log(`   ✅ Matchups already created`);
            } else if (!bothSubmitted) {
                console.log(`   ⏳ Waiting for ${!f.home_lineup_submitted ? 'home' : 'away'} team`);
            }

            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkBlindFixtures().catch(console.error);
