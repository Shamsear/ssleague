require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTournamentDB() {
    const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

    console.log('🔍 Checking Tournament Database...\n');

    // List all tables
    const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name LIKE '%player%'
    ORDER BY table_name
  `;

    console.log('📋 Player-related Tables:');
    tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
    });

    // Check if player_seasons exists
    const hasPlayerSeasons = tables.some(t => t.table_name === 'player_seasons');

    if (hasPlayerSeasons) {
        console.log('\n✅ player_seasons table exists!');

        // Get sample data
        console.log('\n📊 Sample player_seasons data:');
        const players = await sql`
      SELECT player_id, player_name, position, team, star_rating
      FROM player_seasons
      LIMIT 5
    `;

        players.forEach((p, i) => {
            console.log(`\n${i + 1}. ${p.player_name || '❌ NO NAME'}`);
            console.log(`   Player ID: ${p.player_id}`);
            console.log(`   Position: ${p.position || 'N/A'}`);
            console.log(`   Team: ${p.team || 'N/A'}`);
            console.log(`   Star Rating: ${p.star_rating || 'N/A'}`);
        });

        // Check for missing names
        const missingNames = players.filter(p => !p.player_name || p.player_name.trim() === '');
        if (missingNames.length > 0) {
            console.log(`\n⚠️  WARNING: ${missingNames.length} out of ${players.length} sample players have missing names!`);
        } else {
            console.log('\n✅ All sample players have names!');
        }
    } else {
        console.log('\n❌ player_seasons table NOT found!');
    }

    console.log('\n✅ Check complete!');
}

checkTournamentDB().catch(console.error);
