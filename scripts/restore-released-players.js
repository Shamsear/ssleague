/**
 * Script to restore players that were released but still exist in team_players
 * 
 * This script will:
 * 1. Show a preview of players that will be restored
 * 2. Ask for confirmation
 * 3. Restore the team_id in footballplayers from team_players
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    console.log('🔍 Checking for players to restore...\n');

    try {
        // Find players that need restoration
        const playersToRestore = await sql`
      SELECT 
        fp.player_id,
        fp.name as player_name,
        fp.team_id as current_team_id,
        tp.team_id as team_players_team_id,
        t.name as team_name,
        fp.season_id
      FROM footballplayers fp
      INNER JOIN team_players tp ON fp.player_id = tp.player_id AND fp.season_id = tp.season_id
      LEFT JOIN teams t ON tp.team_id = t.id
      WHERE fp.team_id IS NULL
        AND tp.team_id IS NOT NULL
      ORDER BY t.name, fp.name
    `;

        if (playersToRestore.length === 0) {
            console.log('✅ No players need restoration. All data is in sync!');
            process.exit(0);
        }

        console.log(`📋 Found ${playersToRestore.length} player(s) to restore:\n`);
        console.log('─'.repeat(80));
        console.log('Player Name'.padEnd(30) + 'Team'.padEnd(30) + 'Team ID');
        console.log('─'.repeat(80));

        playersToRestore.forEach(player => {
            console.log(
                player.player_name.padEnd(30) +
                (player.team_name || 'Unknown Team').padEnd(30) +
                player.team_players_team_id
            );
        });

        console.log('─'.repeat(80));
        console.log(`\n📊 Total: ${playersToRestore.length} players will be restored\n`);

        // Ask for confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Do you want to proceed with the restoration? (yes/no): ', async (answer) => {
            readline.close();

            if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
                console.log('\n❌ Restoration cancelled.');
                process.exit(0);
            }

            console.log('\n🔄 Restoring players...\n');

            // Perform the restoration
            await sql`
        UPDATE footballplayers fp
        SET team_id = tp.team_id,
            updated_at = NOW()
        FROM team_players tp
        WHERE fp.player_id = tp.player_id
          AND fp.season_id = tp.season_id
          AND fp.team_id IS NULL
          AND tp.team_id IS NOT NULL
      `;

            console.log(`✅ Successfully restored ${playersToRestore.length} player(s)!\n`);

            // Verify the restoration
            console.log('🔍 Verifying restoration...\n');
            const playerIds = playersToRestore.map(p => p.player_id);
            const verifiedPlayers = await sql`
        SELECT 
          fp.player_id,
          fp.name as player_name,
          fp.team_id,
          t.name as team_name
        FROM footballplayers fp
        INNER JOIN team_players tp ON fp.player_id = tp.player_id AND fp.season_id = tp.season_id
        LEFT JOIN teams t ON fp.team_id = t.id
        WHERE fp.player_id = ANY(${playerIds})
        ORDER BY t.name, fp.name
      `;

            console.log('─'.repeat(80));
            console.log('Player Name'.padEnd(30) + 'Team'.padEnd(30) + 'Status');
            console.log('─'.repeat(80));

            verifiedPlayers.forEach(player => {
                const status = player.team_id ? '✅ Restored' : '❌ Failed';
                console.log(
                    player.player_name.padEnd(30) +
                    (player.team_name || 'Unknown Team').padEnd(30) +
                    status
                );
            });

            console.log('─'.repeat(80));
            console.log('\n✨ Restoration complete!\n');

            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
