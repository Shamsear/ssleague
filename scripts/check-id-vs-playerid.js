/**
 * Check the schema difference between id and player_id
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

async function main() {
    console.log('🔍 Checking id vs player_id for Ander Barrenetxea...\n');

    try {
        const result = await sql`
      SELECT 
        id,
        player_id,
        name,
        team_id,
        season_id
      FROM footballplayers
      WHERE name ILIKE ${'%Ander Barrenetxea%'}
    `;

        if (result.length > 0) {
            console.log('📊 Found in footballplayers:');
            result.forEach(p => {
                console.log(`  id: ${p.id}`);
                console.log(`  player_id: ${p.player_id}`);
                console.log(`  name: ${p.name}`);
                console.log(`  team_id: ${p.team_id || 'NULL (Released)'}`);
                console.log(`  season_id: ${p.season_id}\n`);
            });

            // Now check team_players using the id column
            console.log('📊 Checking team_players using id column:');
            const playerId = result[0].id;
            const tpById = await sql`
        SELECT * FROM team_players WHERE player_id = ${playerId}
      `;
            console.log(`  Using id (${playerId}): ${tpById.length > 0 ? '✅ Found' : '❌ Not found'}`);

            // Check using player_id column
            console.log('\n📊 Checking team_players using player_id column:');
            const playerIdCol = result[0].player_id;
            const tpByPlayerId = await sql`
        SELECT * FROM team_players WHERE player_id = ${playerIdCol}
      `;
            console.log(`  Using player_id (${playerIdCol}): ${tpByPlayerId.length > 0 ? '✅ Found' : '❌ Not found'}`);

            if (tpById.length > 0) {
                console.log('\n📋 Record in team_players (using id):');
                tpById.forEach(tp => {
                    console.log(`  player_id in team_players: ${tp.player_id}`);
                    console.log(`  team_id: ${tp.team_id}`);
                    console.log(`  season_id: ${tp.season_id}`);
                });
            }

            if (tpByPlayerId.length > 0) {
                console.log('\n📋 Record in team_players (using player_id):');
                tpByPlayerId.forEach(tp => {
                    console.log(`  player_id in team_players: ${tp.player_id}`);
                    console.log(`  team_id: ${tp.team_id}`);
                    console.log(`  season_id: ${tp.season_id}`);
                });
            }

        } else {
            console.log('❌ Player not found');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
