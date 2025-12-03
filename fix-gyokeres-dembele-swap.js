require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixSwap() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('🔧 Fixing Gyökeres and Dembélé swap in team_players...\n');

  // Get the players from footballplayers with their current teams
  const players = await sql`
    SELECT id, player_id, name, team_id, season_id
    FROM footballplayers
    WHERE (name ILIKE '%gyok%' OR name ILIKE '%demb%' OR name ILIKE '%viktor%')
      AND season_id IS NOT NULL
      AND team_id IS NOT NULL
    ORDER BY name
  `;

  console.log(`Found ${players.length} player(s) in footballplayers:\n`);
  
  for (const player of players) {
    console.log(`📋 ${player.name}`);
    console.log(`   ID: ${player.id}`);
    console.log(`   Player ID: ${player.player_id}`);
    console.log(`   Team: ${player.team_id}`);
    console.log(`   Season: ${player.season_id}`);

    // Check if exists in team_players
    const teamPlayerCheck = await sql`
      SELECT id, team_id
      FROM team_players
      WHERE player_id = ${player.id} AND season_id = ${player.season_id}
    `;

    if (teamPlayerCheck.length > 0) {
      const currentTeam = teamPlayerCheck[0].team_id;
      
      if (currentTeam !== player.team_id) {
        console.log(`   ⚠️  team_players has: ${currentTeam}`);
        console.log(`   🔧 Updating to: ${player.team_id}`);
        
        await sql`
          UPDATE team_players
          SET team_id = ${player.team_id}, updated_at = NOW()
          WHERE player_id = ${player.id} AND season_id = ${player.season_id}
        `;
        
        console.log(`   ✅ Updated!\n`);
      } else {
        console.log(`   ✅ Already correct in team_players\n`);
      }
    } else {
      console.log(`   ⚠️  Not found in team_players (this is normal if not from auction)\n`);
    }
  }

  console.log('✨ Done!');
}

fixSwap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
