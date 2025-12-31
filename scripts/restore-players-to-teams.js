/**
 * Restore released players by syncing team_id from team_players to footballplayers
 * This will bring back the 22 players to their teams
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    console.log('🔍 Finding players to restore...\n');

    try {
        // Find players that need restoration (using correct id mapping)
        const playersToRestore = await sql`
      SELECT 
        fp.id,
        fp.player_id as fp_player_id,
        fp.name as player_name,
        fp.team_id as current_team_id,
        tp.team_id as restore_team_id,
        t.name as team_name,
        fp.season_id
      FROM footballplayers fp
      INNER JOIN team_players tp ON fp.id = tp.player_id AND fp.season_id = tp.season_id
      LEFT JOIN teams t ON tp.team_id = t.id
      WHERE fp.team_id IS NULL
        AND tp.team_id IS NOT NULL
      ORDER BY t.name, fp.name
    `;

        if (playersToRestore.length === 0) {
            console.log('✅ No players need restoration. All data is in sync!\n');
            process.exit(0);
        }

        console.log(`📋 Found ${playersToRestore.length} player(s) to restore:\n`);
        console.log('═'.repeat(90));
        console.log('Player Name'.padEnd(30) + 'Team'.padEnd(30) + 'FP ID'.padEnd(15) + 'Team ID');
        console.log('═'.repeat(90));

        playersToRestore.forEach(p => {
            console.log(
                p.player_name.padEnd(30) +
                (p.team_name || p.restore_team_id).padEnd(30) +
                String(p.id).padEnd(15) +
                p.restore_team_id
            );
        });

        console.log('═'.repeat(90));
        console.log(`\n📊 Total: ${playersToRestore.length} players will be restored to their teams\n`);

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

            console.log('\n🔄 Restoring players to their teams...\n');

            // Perform the restoration using correct id mapping
            const result = await sql`
        UPDATE footballplayers fp
        SET team_id = tp.team_id,
            updated_at = NOW()
        FROM team_players tp
        WHERE fp.id = tp.player_id
          AND fp.season_id = tp.season_id
          AND fp.team_id IS NULL
          AND tp.team_id IS NOT NULL
      `;

            console.log(`✅ Successfully restored ${playersToRestore.length} player(s)!\n`);

            // Verify the restoration
            console.log('🔍 Verifying restoration...\n');
            const fpIds = playersToRestore.map(p => p.id);
            const verifiedPlayers = await sql`
        SELECT 
          fp.id,
          fp.name as player_name,
          fp.team_id,
          t.name as team_name
        FROM footballplayers fp
        LEFT JOIN teams t ON fp.team_id = t.id
        WHERE fp.id = ANY(${fpIds})
        ORDER BY t.name, fp.name
      `;

            console.log('═'.repeat(90));
            console.log('Player Name'.padEnd(30) + 'Team'.padEnd(30) + 'Status');
            console.log('═'.repeat(90));

            verifiedPlayers.forEach(p => {
                const status = p.team_id ? '✅ Restored' : '❌ Failed';
                console.log(
                    p.player_name.padEnd(30) +
                    (p.team_name || p.team_id || 'NULL').padEnd(30) +
                    status
                );
            });

            console.log('═'.repeat(90));
            console.log('\n✨ Restoration complete!\n');

            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
