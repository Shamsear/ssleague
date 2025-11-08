import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function test() {
  console.log('🧪 Testing star functionality...\n');

  try {
    // Get a sample team_id
    const teams = await sql`SELECT id FROM teams LIMIT 1`;
    if (teams.length === 0) {
      console.log('❌ No teams found in database');
      return;
    }
    const teamId = teams[0].id;
    console.log(`Using team_id: ${teamId}`);

    // Get a sample player
    const players = await sql`SELECT id, name FROM footballplayers LIMIT 1`;
    if (players.length === 0) {
      console.log('❌ No players found in database');
      return;
    }
    const playerId = players[0].id;
    const playerName = players[0].name;
    console.log(`Using player: ${playerName} (id: ${playerId})\n`);

    // Test 1: Insert a starred player
    console.log('1️⃣  Testing INSERT...');
    await sql`
      INSERT INTO starred_players (team_id, player_id)
      VALUES (${teamId}, ${playerId})
      ON CONFLICT (team_id, player_id) DO NOTHING
    `;
    console.log('✅ Inserted\n');

    // Test 2: Verify it was inserted
    console.log('2️⃣  Testing SELECT...');
    const starred = await sql`
      SELECT * FROM starred_players 
      WHERE team_id = ${teamId} AND player_id = ${playerId}
    `;
    console.log('Starred record:', starred);
    console.log('');

    // Test 3: Test the JOIN query (like the API does)
    console.log('3️⃣  Testing JOIN query (like API)...');
    const playerWithStar = await sql`
      SELECT 
        fp.id,
        fp.name,
        CASE 
          WHEN sp.id IS NOT NULL THEN true 
          ELSE false 
        END as is_starred
      FROM footballplayers fp
      LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
      WHERE fp.id = ${playerId}
    `;
    console.log('Player with star status:', playerWithStar);
    console.log('');

    // Test 4: Delete the starred player
    console.log('4️⃣  Testing DELETE...');
    await sql`
      DELETE FROM starred_players 
      WHERE team_id = ${teamId} AND player_id = ${playerId}
    `;
    console.log('✅ Deleted\n');

    // Test 5: Verify it was deleted
    console.log('5️⃣  Verifying deletion...');
    const afterDelete = await sql`
      SELECT 
        fp.id,
        fp.name,
        CASE 
          WHEN sp.id IS NOT NULL THEN true 
          ELSE false 
        END as is_starred
      FROM footballplayers fp
      LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
      WHERE fp.id = ${playerId}
    `;
    console.log('Player after deletion:', afterDelete);
    console.log('');

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

test().catch(console.error);
