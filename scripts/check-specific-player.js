/**
 * Quick check for a specific player
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    const playerName = 'Ander Barrenetxea';

    console.log(`🔍 Checking status for: ${playerName}\n`);

    try {
        // Check in footballplayers table
        console.log('📊 Status in footballplayers table:');
        const fpResult = await sql`
      SELECT 
        player_id,
        name,
        team_id,
        season_id,
        updated_at
      FROM footballplayers
      WHERE name ILIKE ${`%${playerName}%`}
    `;

        if (fpResult.length > 0) {
            fpResult.forEach(p => {
                console.log(`  Player ID: ${p.player_id}`);
                console.log(`  Name: ${p.name}`);
                console.log(`  Team ID: ${p.team_id || 'NULL (Released)'}`);
                console.log(`  Season ID: ${p.season_id}`);
                console.log(`  Updated: ${p.updated_at}\n`);
            });
        } else {
            console.log(`  ❌ Not found in footballplayers\n`);
        }

        // Check in team_players table
        console.log('📊 Status in team_players table:');
        const tpResult = await sql`
      SELECT 
        tp.player_id,
        tp.team_id,
        tp.season_id,
        t.name as team_name,
        tp.purchase_price,
        tp.acquired_at
      FROM team_players tp
      LEFT JOIN teams t ON tp.team_id = t.id
      WHERE tp.player_id IN (
        SELECT player_id FROM footballplayers WHERE name ILIKE ${`%${playerName}%`}
      )
    `;

        if (tpResult.length > 0) {
            tpResult.forEach(p => {
                console.log(`  Player ID: ${p.player_id}`);
                console.log(`  Team ID: ${p.team_id}`);
                console.log(`  Team Name: ${p.team_name || 'Unknown'}`);
                console.log(`  Season ID: ${p.season_id}`);
                console.log(`  Purchase Price: ${p.purchase_price}`);
                console.log(`  Acquired: ${p.acquired_at}\n`);
            });
        } else {
            console.log(`  ❌ Not found in team_players\n`);
        }

        // Check for mismatch
        if (fpResult.length > 0 && tpResult.length > 0) {
            const fp = fpResult[0];
            const tp = tpResult[0];

            console.log('🔍 Comparison:');
            if (fp.team_id === null && tp.team_id !== null) {
                console.log(`  ⚠️  MISMATCH DETECTED!`);
                console.log(`  - footballplayers.team_id: NULL (released)`);
                console.log(`  - team_players.team_id: ${tp.team_id} (${tp.team_name})`);
                console.log(`\n  💡 This player was released but still exists in team_players!`);
                console.log(`     Original team: ${tp.team_name}\n`);
            } else if (fp.team_id === tp.team_id) {
                console.log(`  ✅ Both tables match: ${tp.team_name || fp.team_id}\n`);
            } else {
                console.log(`  ⚠️  Team IDs don't match!`);
                console.log(`  - footballplayers: ${fp.team_id}`);
                console.log(`  - team_players: ${tp.team_id}\n`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
