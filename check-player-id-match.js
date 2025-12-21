const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const fantasySql = neon(process.env.FANTASY_DATABASE_URL);
const tournamentSql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    // Get a sample player from fantasy squad
    const squadSample = await fantasySql`
      SELECT real_player_id, player_name
      FROM fantasy_squad
      WHERE league_id = 'SSPSLFLS16'
      LIMIT 3
    `;
    
    console.log('Sample fantasy squad players:');
    squadSample.forEach(p => console.log(`  ${p.player_name} - ID: ${p.real_player_id}`));
    
    // Try to find them in footballplayers by id
    console.log('\nSearching in footballplayers by id field:');
    for (const player of squadSample) {
      const found = await tournamentSql`
        SELECT id, player_id, name, overall_rating
        FROM footballplayers
        WHERE id = ${player.real_player_id}
        LIMIT 1
      `;
      
      if (found.length > 0) {
        console.log(`  ✅ Found ${player.player_name}: id=${found[0].id}, player_id=${found[0].player_id}, rating=${found[0].overall_rating}`);
      } else {
        console.log(`  ❌ Not found by id: ${player.player_name} (${player.real_player_id})`);
      }
    }
    
    // Try to find them by player_id
    console.log('\nSearching in footballplayers by player_id field:');
    for (const player of squadSample) {
      const found = await tournamentSql`
        SELECT id, player_id, name, overall_rating
        FROM footballplayers
        WHERE player_id = ${player.real_player_id}
        LIMIT 1
      `;
      
      if (found.length > 0) {
        console.log(`  ✅ Found ${player.player_name}: id=${found[0].id}, player_id=${found[0].player_id}, rating=${found[0].overall_rating}`);
      } else {
        console.log(`  ❌ Not found by player_id: ${player.player_name} (${player.real_player_id})`);
      }
    }
    
    // Check what IDs are actually in footballplayers
    console.log('\nSample footballplayers IDs:');
    const fpSample = await tournamentSql`
      SELECT id, player_id, name
      FROM footballplayers
      LIMIT 5
    `;
    fpSample.forEach(p => console.log(`  ${p.name} - id: ${p.id}, player_id: ${p.player_id}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
