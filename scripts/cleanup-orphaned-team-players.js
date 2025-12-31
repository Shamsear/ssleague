/**
 * Cleanup script to remove orphaned records from team_players
 * where footballplayers.team_id = NULL (released players)
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    console.log('🔍 Finding orphaned records in team_players...\n');

    try {
        // Find orphaned records (using id, not player_id)
        const orphanedRecords = await sql`
      SELECT 
        fp.id,
        fp.player_id as fp_player_id,
        fp.name as player_name,
        tp.player_id as tp_player_id,
        tp.team_id,
        t.name as team_name,
        fp.season_id
      FROM footballplayers fp
      INNER JOIN team_players tp ON fp.id = tp.player_id AND fp.season_id = tp.season_id
      LEFT JOIN teams t ON tp.team_id = t.id
      WHERE fp.team_id IS NULL
      ORDER BY t.name, fp.name
    `;

        if (orphanedRecords.length === 0) {
            console.log('✅ No orphaned records found. All data is clean!\n');
            process.exit(0);
        }

        console.log(`📋 Found ${orphanedRecords.length} orphaned record(s) in team_players:\n`);
        console.log('─'.repeat(90));
        console.log('Player Name'.padEnd(30) + 'Team'.padEnd(30) + 'FP ID'.padEnd(10) + 'TP player_id');
        console.log('─'.repeat(90));

        orphanedRecords.forEach(p => {
            console.log(
                p.player_name.padEnd(30) +
                (p.team_name || p.team_id).padEnd(30) +
                String(p.id).padEnd(10) +
                p.tp_player_id
            );
        });

        console.log('─'.repeat(90));
        console.log(`\n💡 These players have team_id = NULL in footballplayers`);
        console.log(`   but still exist in team_players table.\n`);

        // Ask for confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question(`Do you want to remove these ${orphanedRecords.length} record(s) from team_players? (yes/no): `, async (answer) => {
            readline.close();

            if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
                console.log('\n❌ Cleanup cancelled.');
                process.exit(0);
            }

            console.log('\n🔄 Removing orphaned records...\n');

            // Delete orphaned records
            const result = await sql`
        DELETE FROM team_players tp
        USING footballplayers fp
        WHERE tp.player_id = fp.id
          AND tp.season_id = fp.season_id
          AND fp.team_id IS NULL
      `;

            console.log(`✅ Successfully removed ${orphanedRecords.length} orphaned record(s)!\n`);

            // Verify cleanup
            console.log('🔍 Verifying cleanup...\n');
            const remaining = await sql`
        SELECT COUNT(*) as count
        FROM footballplayers fp
        INNER JOIN team_players tp ON fp.id = tp.player_id AND fp.season_id = tp.season_id
        WHERE fp.team_id IS NULL
      `;

            if (remaining[0].count === 0) {
                console.log('✅ Cleanup verified! No orphaned records remain.\n');
            } else {
                console.log(`⚠️  Warning: ${remaining[0].count} orphaned record(s) still remain.\n`);
            }

            console.log('✨ Cleanup complete!\n');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
