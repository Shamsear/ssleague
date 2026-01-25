/**
 * Debug blind lineup fixture to see why matchups aren't auto-created
 * Usage: node scripts/debug-blind-lineup-fixture.js <fixture_id>
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fixtureId = process.argv[2] || 'SSPSLS16EL_grpA_leg1_r4_m1';

async function debugFixture() {
    // Use tournament database URL
    const dbUrl = process.env.NEON_TOURNAMENT_DB_URL || process.env.DATABASE_URL;
    const sql = neon(dbUrl);

    console.log(`🔍 Debugging fixture: ${fixtureId}\n`);

    try {
        // 1. Check fixture details
        console.log('1️⃣ Fixture Details:');
        const fixtures = await sql`
            SELECT 
                id, matchup_mode, 
                home_team_id, home_team_name,
                away_team_id, away_team_name,
                home_lineup_submitted, away_lineup_submitted,
                lineups_locked
            FROM fixtures
            WHERE id = ${fixtureId}
        `;

        if (fixtures.length === 0) {
            console.log('❌ Fixture not found!');
            return;
        }

        const fixture = fixtures[0];
        console.log(`   Matchup Mode: ${fixture.matchup_mode}`);
        console.log(`   Home Team: ${fixture.home_team_name} (${fixture.home_team_id})`);
        console.log(`   Away Team: ${fixture.away_team_name} (${fixture.away_team_id})`);
        console.log(`   Home Lineup Submitted: ${fixture.home_lineup_submitted}`);
        console.log(`   Away Lineup Submitted: ${fixture.away_lineup_submitted}`);
        console.log(`   Lineups Locked: ${fixture.lineups_locked}`);

        // 2. Check lineup submissions
        console.log('\n2️⃣ Lineup Submissions:');
        const lineups = await sql`
            SELECT 
                team_id, 
                players,
                is_locked,
                submitted_at
            FROM lineup_submissions
            WHERE fixture_id = ${fixtureId}
        `;

        console.log(`   Found ${lineups.length} lineup submission(s)`);
        
        for (const lineup of lineups) {
            const teamName = lineup.team_id === fixture.home_team_id ? 'Home' : 'Away';
            console.log(`\n   ${teamName} Team (${lineup.team_id}):`);
            console.log(`   - Locked: ${lineup.is_locked}`);
            console.log(`   - Submitted: ${lineup.submitted_at}`);
            
            // Parse players
            let players;
            try {
                players = typeof lineup.players === 'string' 
                    ? JSON.parse(lineup.players) 
                    : lineup.players;
            } catch (e) {
                console.log(`   - ❌ Failed to parse players JSON`);
                continue;
            }

            const playingPlayers = players.filter(p => !p.is_substitute);
            const substitutes = players.filter(p => p.is_substitute);
            
            console.log(`   - Playing: ${playingPlayers.length} players`);
            console.log(`   - Substitutes: ${substitutes.length} players`);
            
            playingPlayers.forEach((p, i) => {
                console.log(`     ${i + 1}. ${p.player_name} (pos: ${p.position})`);
            });
        }

        // 3. Check existing matchups
        console.log('\n3️⃣ Existing Matchups:');
        const matchups = await sql`
            SELECT 
                position,
                home_player_name,
                away_player_name,
                home_goals,
                away_goals
            FROM matchups
            WHERE fixture_id = ${fixtureId}
            ORDER BY position
        `;

        if (matchups.length === 0) {
            console.log('   ❌ No matchups found');
        } else {
            console.log(`   ✅ Found ${matchups.length} matchup(s):`);
            matchups.forEach(m => {
                console.log(`   ${m.position}. ${m.home_player_name} vs ${m.away_player_name}`);
            });
        }

        // 4. Diagnosis
        console.log('\n4️⃣ Diagnosis:');
        
        if (fixture.matchup_mode !== 'blind_lineup') {
            console.log('   ❌ Fixture is not in blind_lineup mode');
        } else {
            console.log('   ✅ Fixture is in blind_lineup mode');
        }

        if (!fixture.home_lineup_submitted) {
            console.log('   ❌ Home team has not submitted lineup');
        } else {
            console.log('   ✅ Home team submitted lineup');
        }

        if (!fixture.away_lineup_submitted) {
            console.log('   ❌ Away team has not submitted lineup');
        } else {
            console.log('   ✅ Away team submitted lineup');
        }

        if (fixture.lineups_locked) {
            console.log('   ⚠️  Lineups already locked (matchups should exist)');
        } else {
            console.log('   ⏳ Lineups not locked yet');
        }

        if (lineups.length !== 2) {
            console.log(`   ❌ Expected 2 lineup submissions, found ${lineups.length}`);
        } else {
            console.log('   ✅ Both teams have lineup submissions');
        }

        // 5. Recommendation
        console.log('\n5️⃣ Recommendation:');
        
        if (fixture.matchup_mode !== 'blind_lineup') {
            console.log('   This fixture is not in blind_lineup mode. Matchups must be created manually.');
        } else if (!fixture.home_lineup_submitted || !fixture.away_lineup_submitted) {
            console.log('   Wait for both teams to submit their lineups.');
        } else if (fixture.lineups_locked && matchups.length > 0) {
            console.log('   Matchups already created and locked.');
        } else if (fixture.lineups_locked && matchups.length === 0) {
            console.log('   ⚠️  Lineups locked but no matchups found. This is unusual.');
            console.log('   Run: node scripts/create-matchups-for-fixture.js ' + fixtureId);
        } else if (lineups.length !== 2) {
            console.log('   ❌ Missing lineup submissions in database.');
        } else {
            console.log('   ✅ Ready to create matchups!');
            console.log('   Run: node scripts/create-matchups-for-fixture.js ' + fixtureId);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

debugFixture().catch(console.error);
