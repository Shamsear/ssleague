require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testPlayerFetch() {
    const tournamentSql = neon(process.env.NEON_DATABASE_URL);
    const fantasySql = neon(process.env.FANTASY_DATABASE_URL);

    console.log('🔍 Testing Player Data Fetch...\n');

    // Get a sample player from tournament DB
    console.log('📊 Fetching from tournament database (player_seasons):');
    const players = await tournamentSql`
    SELECT player_id, player_name, position, team, star_rating
    FROM player_seasons
    LIMIT 5
  `;

    if (players.length > 0) {
        console.log('✅ Found players in tournament database:\n');
        players.forEach((p, i) => {
            console.log(`${i + 1}. ${p.player_name || 'MISSING NAME'} (${p.position || 'NO POSITION'})`);
            console.log(`   Team: ${p.team || 'NO TEAM'}`);
            console.log(`   Player ID: ${p.player_id}`);
            console.log(`   Star Rating: ${p.star_rating || 'N/A'}`);
            console.log('');
        });

        // Check if any have missing names
        const missingNames = players.filter(p => !p.player_name);
        if (missingNames.length > 0) {
            console.log(`⚠️  WARNING: ${missingNames.length} players have missing names!`);
        } else {
            console.log('✅ All players have names!');
        }
    } else {
        console.log('❌ No players found in tournament database');
    }

    // Check fantasy database
    console.log('\n📊 Checking fantasy database (fantasy_players):');
    const fantasyPlayers = await fantasySql`
    SELECT real_player_id, player_name, position, real_team_name
    FROM fantasy_players
    LIMIT 5
  `;

    if (fantasyPlayers.length > 0) {
        console.log('✅ Found players in fantasy database:\n');
        fantasyPlayers.forEach((p, i) => {
            console.log(`${i + 1}. ${p.player_name || 'MISSING NAME'} (${p.position || 'NO POSITION'})`);
            console.log(`   Team: ${p.real_team_name || 'NO TEAM'}`);
            console.log(`   Real Player ID: ${p.real_player_id}`);
            console.log('');
        });
    }

    console.log('\n✅ Test complete!');
}

testPlayerFetch().catch(console.error);
