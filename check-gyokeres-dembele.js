require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkPlayers() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('🔍 Checking Gyökeres and Dembélé...\n');

  // Check in footballplayers
  const fpPlayers = await sql`
    SELECT player_id, name, team_id, season_id
    FROM footballplayers
    WHERE name ILIKE '%gyok%' OR name ILIKE '%demb%'
    ORDER BY name
  `;

  console.log('📋 In footballplayers table:');
  fpPlayers.forEach(p => {
    console.log(`  ${p.name} (${p.player_id})`);
    console.log(`    Team: ${p.team_id}`);
    console.log(`    Season: ${p.season_id}\n`);
  });

  // Check in team_players
  const tpPlayers = await sql`
    SELECT tp.player_id, fp.name, tp.team_id, tp.season_id
    FROM team_players tp
    LEFT JOIN footballplayers fp ON tp.player_id = fp.player_id AND tp.season_id = fp.season_id
    WHERE fp.name ILIKE '%gyok%' OR fp.name ILIKE '%demb%'
    ORDER BY fp.name
  `;

  console.log('📋 In team_players table:');
  if (tpPlayers.length === 0) {
    console.log('  ❌ No records found!\n');
  } else {
    tpPlayers.forEach(p => {
      console.log(`  ${p.name} (${p.player_id})`);
      console.log(`    Team: ${p.team_id}`);
      console.log(`    Season: ${p.season_id}\n`);
    });
  }

  // Check for mismatches
  if (fpPlayers.length > 0 && tpPlayers.length > 0) {
    console.log('🔍 Checking for mismatches...\n');
    
    for (const fp of fpPlayers) {
      const tp = tpPlayers.find(t => t.player_id === fp.player_id);
      if (tp) {
        if (tp.team_id !== fp.team_id) {
          console.log(`⚠️  MISMATCH: ${fp.name}`);
          console.log(`   footballplayers: ${fp.team_id}`);
          console.log(`   team_players: ${tp.team_id}\n`);
        } else {
          console.log(`✅ ${fp.name} - teams match (${fp.team_id})\n`);
        }
      } else {
        console.log(`⚠️  ${fp.name} exists in footballplayers but NOT in team_players\n`);
      }
    }
  }
}

checkPlayers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
