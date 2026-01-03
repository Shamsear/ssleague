require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkPlayerSeasonsSchema() {
  if (!process.env.FANTASY_DATABASE_URL) {
    console.error('❌ FANTASY_DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const sql = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔍 Checking player_seasons Schema...\n');

  // Check player_seasons columns
  console.log('📋 player_seasons columns:');
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'player_seasons'
    ORDER BY ordinal_position
  `;

  cols.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });

  // Get a sample player
  console.log('\n📊 Sample player data:');
  const sample = await sql`
    SELECT * FROM player_seasons
    LIMIT 3
  `;

  if (sample.length > 0) {
    sample.forEach((player, index) => {
      console.log(`\n${index + 1}. Player ID: ${player.player_id}`);
      console.log(`   All fields:`, JSON.stringify(player, null, 2));
    });
  } else {
    console.log('No players found in player_seasons');
  }

  console.log('\n✅ Check complete!');
}

checkPlayerSeasonsSchema().catch(console.error);
