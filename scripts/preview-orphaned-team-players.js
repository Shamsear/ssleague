/**
 * PREVIEW ONLY - Show orphaned records in team_players
 * This script does NOT make any changes, just shows what would be cleaned up
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    console.log('🔍 PREVIEW: Finding orphaned records in team_players...\n');
    console.log('⚠️  This is a PREVIEW ONLY - no changes will be made\n');

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
        fp.season_id,
        tp.purchase_price
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
        console.log('═'.repeat(100));
        console.log('Player Name'.padEnd(30) + 'Team'.padEnd(25) + 'FP.id'.padEnd(10) + 'TP.player_id'.padEnd(15) + 'Price');
        console.log('═'.repeat(100));

        orphanedRecords.forEach(p => {
            console.log(
                p.player_name.padEnd(30) +
                (p.team_name || p.team_id).padEnd(25) +
                String(p.id).padEnd(10) +
                String(p.tp_player_id).padEnd(15) +
                (p.purchase_price || 'N/A')
            );
        });

        console.log('═'.repeat(100));
        console.log(`\n📊 Summary:`);
        console.log(`   Total orphaned records: ${orphanedRecords.length}`);
        console.log(`   These players have team_id = NULL in footballplayers`);
        console.log(`   but still exist in team_players table.\n`);

        // Group by team
        const byTeam = {};
        orphanedRecords.forEach(p => {
            const team = p.team_name || p.team_id;
            if (!byTeam[team]) byTeam[team] = [];
            byTeam[team].push(p.player_name);
        });

        console.log('📊 Breakdown by team:');
        console.log('─'.repeat(100));
        Object.entries(byTeam).forEach(([team, players]) => {
            console.log(`\n${team} (${players.length} players):`);
            players.forEach(name => console.log(`  • ${name}`));
        });
        console.log('─'.repeat(100));

        console.log(`\n💡 Next steps:`);
        console.log(`   1. Review the list above`);
        console.log(`   2. If correct, run: node scripts/cleanup-orphaned-team-players.js`);
        console.log(`   3. That script will ask for confirmation before deleting\n`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
