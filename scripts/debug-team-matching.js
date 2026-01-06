require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function debugTeamMatching() {
    const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
    const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Debugging Team ID Matching\n');

    try {
        // 1. Get fantasy teams and their supported teams
        console.log('1️⃣ Fantasy Teams and their supported teams:');
        const fantasyTeams = await fantasyDb`
      SELECT team_id, team_name, supported_team_id, supported_team_name
      FROM fantasy_teams
      WHERE league_id = 'SSPSLFLS16'
        AND supported_team_id IS NOT NULL
      ORDER BY team_name
    `;

        console.log(`Found ${fantasyTeams.length} fantasy teams with supported teams:\n`);
        fantasyTeams.forEach(team => {
            console.log(`  ${team.team_name}`);
            console.log(`    Fantasy Team ID: ${team.team_id}`);
            console.log(`    Supported Team ID: ${team.supported_team_id}`);
            console.log(`    Supported Team Name: ${team.supported_team_name}`);
            console.log('');
        });

        // 2. Get a sample fixture and its team IDs
        console.log('\n2️⃣ Sample Fixture Team IDs:');
        const fixtures = await tournamentDb`
      SELECT id, home_team_id, away_team_id, home_team_name, away_team_name, round_number
      FROM fixtures
      WHERE season_id = 'SSPSLS16'
        AND status = 'completed'
      ORDER BY round_number
      LIMIT 3
    `;

        console.log(`Sample fixtures:\n`);
        fixtures.forEach(fixture => {
            console.log(`  Round ${fixture.round_number}: ${fixture.home_team_name} vs ${fixture.away_team_name}`);
            console.log(`    Home Team ID: ${fixture.home_team_id}`);
            console.log(`    Away Team ID: ${fixture.away_team_id}`);
            console.log('');
        });

        // 3. Check team changes
        console.log('\n3️⃣ Team Changes:');
        const changes = await fantasyDb`
      SELECT team_id, old_supported_team_id, new_supported_team_id, old_supported_team_name, new_supported_team_name
      FROM supported_team_changes
      WHERE league_id = 'SSPSLFLS16'
    `;

        console.log(`Found ${changes.length} team changes:\n`);
        changes.forEach(change => {
            console.log(`  Team: ${change.team_id}`);
            console.log(`    Old: ${change.old_supported_team_id} (${change.old_supported_team_name})`);
            console.log(`    New: ${change.new_supported_team_id} (${change.new_supported_team_name})`);
            console.log('');
        });

        // 4. Try to match
        console.log('\n4️⃣ Matching Test:');
        const sampleRealTeamId = fixtures[0].home_team_id;
        console.log(`Testing with real team ID: ${sampleRealTeamId}`);

        const matches = fantasyTeams.filter(team => {
            return team.supported_team_id === sampleRealTeamId ||
                team.supported_team_id === `${sampleRealTeamId}_SSPSLS16`;
        });

        console.log(`\nDirect matches: ${matches.length}`);
        if (matches.length > 0) {
            matches.forEach(m => console.log(`  - ${m.team_name} (${m.supported_team_id})`));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugTeamMatching();
