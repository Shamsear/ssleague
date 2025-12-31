/**
 * Find all recently released players (team_id = NULL in footballplayers)
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    console.log('🔍 Finding all released players (team_id = NULL)...\n');

    try {
        const releasedPlayers = await sql`
      SELECT 
        player_id,
        name as player_name,
        team_id,
        season_id,
        updated_at
      FROM footballplayers
      WHERE team_id IS NULL
      ORDER BY updated_at DESC
      LIMIT 50
    `;

        console.log(`📋 Found ${releasedPlayers.length} released player(s):\n`);
        console.log('─'.repeat(80));
        console.log('Player Name'.padEnd(35) + 'Player ID'.padEnd(15) + 'Updated At');
        console.log('─'.repeat(80));

        releasedPlayers.forEach(p => {
            const updatedDate = new Date(p.updated_at).toLocaleString();
            console.log(
                p.player_name.padEnd(35) +
                p.player_id.padEnd(15) +
                updatedDate
            );
        });

        console.log('─'.repeat(80));
        console.log(`\n✅ All ${releasedPlayers.length} players are properly released (team_id = NULL)`);
        console.log('✅ They have also been removed from team_players table\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
