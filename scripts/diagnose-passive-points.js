const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
const tournamentDb = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function diagnose() {
    console.log('🔍 Diagnosing why passive points are 0...\n');

    try {
        // Check 1: Do fantasy teams have supported_team_id?
        console.log('1️⃣ Checking fantasy teams with supported teams...');
        const teamsWithSupport = await fantasyDb`
      SELECT team_name, supported_team_id, supported_team_name
      FROM fantasy_teams
      WHERE supported_team_id IS NOT NULL
    `;

        console.log(`   Found ${teamsWithSupport.length} teams with supported teams:`);
        teamsWithSupport.forEach(t => {
            console.log(`   - ${t.team_name} → ${t.supported_team_name} (${t.supported_team_id})`);
        });

        if (teamsWithSupport.length === 0) {
            console.log('\n❌ ISSUE: No fantasy teams have a supported_team_id set!');
            console.log('   Teams need to select a supported team first.');
            return;
        }

        // Check 2: Get sample fixture team IDs
        console.log('\n2️⃣ Checking fixture team ID format...');
        const sampleFixtures = await tournamentDb`
      SELECT home_team_id, away_team_id
      FROM fixtures
      WHERE status = 'completed'
      LIMIT 3
    `;

        console.log('   Sample fixture team IDs:');
        sampleFixtures.forEach(f => {
            console.log(`   - Home: ${f.home_team_id}, Away: ${f.away_team_id}`);
        });

        // Check 3: Do any supported_team_ids match fixture team IDs?
        console.log('\n3️⃣ Checking for matches...');
        const supportedIds = teamsWithSupport.map(t => t.supported_team_id);

        for (const supportedId of supportedIds) {
            const matches = await tournamentDb`
        SELECT COUNT(*) as count
        FROM fixtures
        WHERE (home_team_id = ${supportedId} OR away_team_id = ${supportedId})
          AND status = 'completed'
      `;

            const team = teamsWithSupport.find(t => t.supported_team_id === supportedId);
            console.log(`   ${team.supported_team_name} (${supportedId}): ${matches[0].count} fixtures found`);
        }

        // Check 4: Get actual team IDs from teamstats table
        console.log('\n4️⃣ Checking teamstats table for correct IDs...');
        const realTeams = await tournamentDb`
      SELECT DISTINCT team_id, team_name
      FROM teamstats
      WHERE season_id = 'S16'
      ORDER BY team_name
      LIMIT 10
    `;

        console.log('   Real team IDs in database:');
        realTeams.forEach(t => {
            console.log(`   - ${t.team_name}: ${t.team_id}`);
        });

        // Check 5: Compare formats
        console.log('\n5️⃣ Format comparison:');
        if (supportedIds.length > 0 && realTeams.length > 0) {
            console.log(`   Fantasy supported_team_id format: ${supportedIds[0]}`);
            console.log(`   Tournament team_id format: ${realTeams[0].team_id}`);

            if (supportedIds[0].includes('_S16') && !realTeams[0].team_id.includes('_S16')) {
                console.log('\n❌ ISSUE: Format mismatch detected!');
                console.log('   Fantasy teams have season-specific IDs (e.g., TEAM_FCB_S16)');
                console.log('   But fixtures use base team IDs (e.g., TEAM_FCB)');
                console.log('\n💡 SOLUTION: Need to strip the season suffix when matching');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

diagnose();
