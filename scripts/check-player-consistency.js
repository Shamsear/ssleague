/**
 * Script to check data consistency between footballplayers and team_players tables
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    console.log('🔍 Checking data consistency...\n');

    try {
        // Check 1: Players in team_players but NOT in footballplayers (orphaned records)
        console.log('📊 Check 1: Orphaned records in team_players\n');
        const orphanedInTeamPlayers = await sql`
      SELECT 
        tp.player_id,
        tp.team_id,
        tp.season_id,
        t.name as team_name
      FROM team_players tp
      LEFT JOIN footballplayers fp ON tp.player_id = fp.player_id AND tp.season_id = fp.season_id
      LEFT JOIN teams t ON tp.team_id = t.id
      WHERE fp.player_id IS NULL
      ORDER BY t.name
    `;

        if (orphanedInTeamPlayers.length > 0) {
            console.log(`⚠️  Found ${orphanedInTeamPlayers.length} orphaned record(s) in team_players:`);
            console.log('─'.repeat(80));
            orphanedInTeamPlayers.forEach(p => {
                console.log(`  • Player ID: ${p.player_id} | Team: ${p.team_name || p.team_id}`);
            });
            console.log('─'.repeat(80));
        } else {
            console.log('✅ No orphaned records in team_players\n');
        }

        // Check 2: Players with team_id in footballplayers but NOT in team_players
        console.log('\n📊 Check 2: Players assigned in footballplayers but missing from team_players\n');
        const missingFromTeamPlayers = await sql`
      SELECT 
        fp.player_id,
        fp.name as player_name,
        fp.team_id,
        fp.season_id,
        t.name as team_name
      FROM footballplayers fp
      LEFT JOIN team_players tp ON fp.player_id = tp.player_id AND fp.season_id = tp.season_id
      LEFT JOIN teams t ON fp.team_id = t.id
      WHERE fp.team_id IS NOT NULL
        AND tp.player_id IS NULL
      ORDER BY t.name, fp.name
    `;

        if (missingFromTeamPlayers.length > 0) {
            console.log(`⚠️  Found ${missingFromTeamPlayers.length} player(s) missing from team_players:`);
            console.log('─'.repeat(80));
            console.log('Player Name'.padEnd(30) + 'Team'.padEnd(30) + 'Player ID');
            console.log('─'.repeat(80));
            missingFromTeamPlayers.forEach(p => {
                console.log(
                    p.player_name.padEnd(30) +
                    (p.team_name || p.team_id).padEnd(30) +
                    p.player_id
                );
            });
            console.log('─'.repeat(80));
        } else {
            console.log('✅ All assigned players exist in team_players\n');
        }

        // Check 3: Mismatched team_id between tables
        console.log('\n📊 Check 3: Team ID mismatches between tables\n');
        const mismatches = await sql`
      SELECT 
        fp.player_id,
        fp.name as player_name,
        fp.team_id as fp_team_id,
        tp.team_id as tp_team_id,
        fp.season_id,
        t1.name as fp_team_name,
        t2.name as tp_team_name
      FROM footballplayers fp
      INNER JOIN team_players tp ON fp.player_id = tp.player_id AND fp.season_id = tp.season_id
      LEFT JOIN teams t1 ON fp.team_id = t1.id
      LEFT JOIN teams t2 ON tp.team_id = t2.id
      WHERE fp.team_id != tp.team_id
      ORDER BY fp.name
    `;

        if (mismatches.length > 0) {
            console.log(`⚠️  Found ${mismatches.length} team ID mismatch(es):`);
            console.log('─'.repeat(80));
            console.log('Player Name'.padEnd(25) + 'FP Team'.padEnd(25) + 'TP Team');
            console.log('─'.repeat(80));
            mismatches.forEach(p => {
                console.log(
                    p.player_name.padEnd(25) +
                    (p.fp_team_name || p.fp_team_id || 'NULL').padEnd(25) +
                    (p.tp_team_name || p.tp_team_id || 'NULL')
                );
            });
            console.log('─'.repeat(80));
        } else {
            console.log('✅ No team ID mismatches found\n');
        }

        // Check 4: Players released (team_id = NULL) but still in team_players
        console.log('\n📊 Check 4: Released players still in team_players (THE 22 PLAYERS)\n');
        const releasedButInTeamPlayers = await sql`
      SELECT 
        fp.player_id,
        fp.name as player_name,
        tp.team_id,
        t.name as team_name,
        fp.season_id
      FROM footballplayers fp
      INNER JOIN team_players tp ON fp.player_id = tp.player_id AND fp.season_id = tp.season_id
      LEFT JOIN teams t ON tp.team_id = t.id
      WHERE fp.team_id IS NULL
        AND tp.team_id IS NOT NULL
      ORDER BY t.name, fp.name
    `;

        if (releasedButInTeamPlayers.length > 0) {
            console.log(`⚠️  Found ${releasedButInTeamPlayers.length} released player(s) still in team_players:`);
            console.log('─'.repeat(80));
            console.log('Player Name'.padEnd(30) + 'Team (in team_players)'.padEnd(30) + 'Player ID');
            console.log('─'.repeat(80));
            releasedButInTeamPlayers.forEach(p => {
                console.log(
                    p.player_name.padEnd(30) +
                    (p.team_name || p.team_id).padEnd(30) +
                    p.player_id
                );
            });
            console.log('─'.repeat(80));
            console.log(`\n💡 These are likely the 22 players you released!`);
            console.log(`   Run restore-released-players.js to bring them back.\n`);
        } else {
            console.log('✅ No released players found in team_players\n');
        }

        // Summary
        console.log('\n' + '═'.repeat(80));
        console.log('📋 SUMMARY');
        console.log('═'.repeat(80));
        console.log(`Orphaned in team_players: ${orphanedInTeamPlayers.length}`);
        console.log(`Missing from team_players: ${missingFromTeamPlayers.length}`);
        console.log(`Team ID mismatches: ${mismatches.length}`);
        console.log(`Released but in team_players: ${releasedButInTeamPlayers.length}`);
        console.log('═'.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
